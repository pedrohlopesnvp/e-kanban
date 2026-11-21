import { Prisma, type Priority, type ReplenishmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { num, roundQty } from "@/lib/numbers";
import { writeAudit } from "@/server/audit";
import type { SessionUser } from "@/server/auth/session";
import type { KanbanColumnId } from "@/lib/labels";
import {
  ACTIVE_REPLENISHMENT_STATUSES,
  canTransition,
  computePriority,
  isCritical,
  kanbanStage,
  requestedQuantity,
  awaitingPhysicalReceipt,
  shouldAutoRequest,
} from "@/server/stock/rules";

function decimal(value: number) {
  return new Prisma.Decimal(roundQty(value).toFixed(3));
}

type MaterialSnapshot = {
  id: string;
  active: boolean;
  reorderPoint: Prisma.Decimal;
  reorderQty: Prisma.Decimal;
  maxStock: Prisma.Decimal;
  minStock: Prisma.Decimal;
};

async function lockMaterial(tx: Prisma.TransactionClient, materialId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${materialId}))`;
}

async function locationAvailable(tx: Prisma.TransactionClient, materialId: string, locationId: string) {
  const rows = await tx.stockBalance.findMany({ where: { materialId, locationId } });
  return roundQty(rows.reduce((sum, row) => sum + num(row.onHand) - num(row.reserved), 0));
}

async function findActive(tx: Prisma.TransactionClient, materialId: string, locationId: string) {
  return tx.replenishmentRequest.findFirst({
    where: { materialId, locationId, status: { in: [...ACTIVE_REPLENISHMENT_STATUSES] } },
  });
}

export async function openReplenishment(
  tx: Prisma.TransactionClient,
  input: {
    material: MaterialSnapshot;
    locationId: string;
    availableQty: number;
    quantity?: number;
    status?: ReplenishmentStatus;
    source: "AUTO" | "MANUAL";
    priority?: Priority;
    userId?: string | null;
    assigneeId?: string | null;
    note?: string | null;
    force?: boolean;
  },
) {
  await lockMaterial(tx, input.material.id);
  const location = await tx.location.findUnique({ where: { id: input.locationId } });
  if (!location || !location.active) throw new AppError("Localização inválida.");
  const existing = await findActive(tx, input.material.id, input.locationId);
  const latest = await tx.replenishmentRequest.findFirst({
    where: { materialId: input.material.id, locationId: input.locationId },
    orderBy: { openedAt: "desc" },
  });
  if (input.source === "AUTO" && !input.force && latest?.status === "REPLENISHED" && latest.closedAt) {
    const receipt = await tx.movement.findFirst({
      where: {
        materialId: input.material.id,
        createdAt: { gt: latest.closedAt },
        OR: [
          { type: { in: ["IN", "RETURN"] }, toLocationId: input.locationId },
          { type: "TRANSFER", toLocationId: input.locationId },
          { type: "ADJUSTMENT", toLocationId: input.locationId, quantitySigned: { gt: 0 } },
        ],
      },
    });
    if (
      !receipt &&
      awaitingPhysicalReceipt({
        latestStatus: latest.status,
        availableQty: input.availableQty,
        reorderPoint: num(input.material.reorderPoint),
      })
    ) {
      return latest;
    }
  }
  if (existing) {
    if (input.source === "AUTO" || input.force) return existing;
    throw new AppError("Já existe uma reposição ativa para este material nesta localização.");
  }
  if (!input.force && input.source === "AUTO") {
    const allowed = shouldAutoRequest({
      active: input.material.active,
      reorderPoint: num(input.material.reorderPoint),
      availableQty: input.availableQty,
      hasActiveRequest: false,
    });
    if (!allowed) return null;
  }
  const quantity =
    input.quantity && input.quantity > 0
      ? roundQty(input.quantity)
      : requestedQuantity(num(input.material.reorderQty), num(input.material.maxStock), input.availableQty);
  const status = input.status ?? (input.source === "AUTO" ? "NEEDED" : "REQUESTED");
  const priority = input.priority ?? computePriority(input.availableQty, num(input.material.minStock));
  try {
    const request = await tx.replenishmentRequest.create({
      data: {
        materialId: input.material.id,
        locationId: input.locationId,
        status,
        priority,
        quantity: decimal(quantity),
        availableAtOpen: decimal(input.availableQty),
        source: input.source,
        requestedById: input.userId ?? null,
        assigneeId: input.assigneeId ?? null,
        note: input.note ?? null,
      },
    });
    await tx.replenishmentEvent.create({
      data: {
        requestId: request.id,
        toStatus: status,
        userId: input.userId ?? null,
        note: input.note ?? (input.source === "AUTO" ? "Solicitação automática." : "Solicitação manual."),
      },
    });
    await writeAudit(tx, {
      userId: input.userId,
      action: input.source === "AUTO" ? "REPLENISHMENT_AUTO" : "REPLENISHMENT_MANUAL",
      entity: "ReplenishmentRequest",
      entityId: request.id,
      metadata: { materialId: input.material.id, locationId: input.locationId, status },
    });
    return request;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return findActive(tx, input.material.id, input.locationId);
    }
    throw error;
  }
}

async function fulfillIfRecovered(
  tx: Prisma.TransactionClient,
  material: MaterialSnapshot,
  locationId: string,
  availableQty: number,
  userId?: string | null,
) {
  const stage = kanbanStage({
    availableQty,
    maxStock: num(material.maxStock),
    reorderPoint: num(material.reorderPoint),
    minStock: num(material.minStock),
  });
  if (stage !== "IN_USE" && stage !== "AVAILABLE") return;
  const existing = await findActive(tx, material.id, locationId);
  if (!existing) return;
  await tx.replenishmentRequest.update({
    where: { id: existing.id },
    data: { status: "REPLENISHED", quantity: decimal(0), closedAt: new Date() },
  });
  await tx.replenishmentEvent.create({
    data: {
      requestId: existing.id,
      fromStatus: existing.status,
      toStatus: "REPLENISHED",
      userId: userId ?? null,
      note: "O saldo voltou para uso e a solicitação foi preenchida.",
    },
  });
  await tx.container.updateMany({
    where: {
      locationId,
      status: "IN_REPLENISHMENT",
      balances: { some: { materialId: material.id } },
    },
    data: { status: "ACTIVE" },
  });
  await writeAudit(tx, {
    userId,
    action: "REPLENISHMENT_STATUS",
    entity: "ReplenishmentRequest",
    entityId: existing.id,
    metadata: { from: existing.status, to: "REPLENISHED", reason: "stock-recovered" },
  });
}

export async function syncAfterStockChange(
  tx: Prisma.TransactionClient,
  materialId: string,
  locationIds: string[],
  userId?: string | null,
) {
  const material = await tx.material.findUnique({ where: { id: materialId } });
  if (!material) return;
  for (const locationId of locationIds) {
    const availableQty = await locationAvailable(tx, materialId, locationId);
    await fulfillIfRecovered(tx, material, locationId, availableQty, userId);
    await openReplenishment(tx, {
      material,
      locationId,
      availableQty,
      source: "AUTO",
      userId,
      note: "Estoque atingiu o ponto de reposição.",
    });
  }
}

async function closeRecoveredReplenishments() {
  const active = await prisma.replenishmentRequest.findMany({
    where: { status: { in: [...ACTIVE_REPLENISHMENT_STATUSES] } },
    include: { material: true },
  });
  if (active.length === 0) return;
  await prisma.$transaction(async (tx) => {
    for (const request of active) {
      const availableQty = await locationAvailable(tx, request.materialId, request.locationId);
      await fulfillIfRecovered(tx, request.material, request.locationId, availableQty, null);
    }
  });
}

export async function triggerTwoBin(
  tx: Prisma.TransactionClient,
  input: { containerId: string; materialId: string; locationId: string; onHand: number; userId: string },
) {
  if (input.onHand > 0) return;
  const container = await tx.container.findUnique({ where: { id: input.containerId } });
  if (!container || container.binRole !== "TRIGGER") return;
  const material = await tx.material.findUnique({ where: { id: input.materialId } });
  if (!material) return;
  const availableQty = await locationAvailable(tx, input.materialId, input.locationId);
  const request = await openReplenishment(tx, {
    material,
    locationId: input.locationId,
    availableQty,
    source: "AUTO",
    userId: input.userId,
    force: true,
    note: `Kanban de duas caixas: a caixa ${container.code} foi consumida e a outra permanece disponível.`,
  });
  if (request && ["NEEDED", "REQUESTED", "IN_SUPPLY"].includes(request.status)) {
    await tx.container.update({
      where: { id: container.id },
      data: { status: "IN_REPLENISHMENT" },
    });
  }
}

export async function ensureAutoReplenishments() {
  const materials = await prisma.material.findMany({
    where: { active: true, reorderPoint: { gt: 0 } },
    include: { balances: true },
  });
  if (materials.length === 0) return;
  const active = await prisma.replenishmentRequest.findMany({
    where: {
      materialId: { in: materials.map((material) => material.id) },
      status: { in: [...ACTIVE_REPLENISHMENT_STATUSES] },
    },
    select: { materialId: true, locationId: true },
  });
  const activeKeys = new Set(active.map((item) => `${item.materialId}:${item.locationId}`));
  for (const material of materials) {
    const locations = new Set<string>();
    for (const balance of material.balances) locations.add(balance.locationId);
    if (material.defaultLocationId) locations.add(material.defaultLocationId);
    for (const locationId of locations) {
      if (activeKeys.has(`${material.id}:${locationId}`)) continue;
      const availableQty = roundQty(
        material.balances
          .filter((balance) => balance.locationId === locationId)
          .reduce((sum, balance) => sum + num(balance.onHand) - num(balance.reserved), 0),
      );
      if (
        !shouldAutoRequest({
          active: material.active,
          reorderPoint: num(material.reorderPoint),
          availableQty,
          hasActiveRequest: false,
        })
      ) {
        continue;
      }
      await prisma.$transaction(async (tx) => {
        const current = await locationAvailable(tx, material.id, locationId);
        await openReplenishment(tx, {
          material,
          locationId,
          availableQty: current,
          source: "AUTO",
          note: "Estoque atingiu o ponto de reposição.",
        });
      });
    }
  }
}

export async function createManualReplenishment(
  user: SessionUser,
  input: {
    materialId: string;
    locationId: string;
    quantity: number;
    priority: Priority;
    status: "NEEDED" | "REQUESTED" | "IN_SUPPLY";
    note?: string | null;
    assigneeId?: string | null;
  },
) {
  return prisma.$transaction(async (tx) => {
    const material = await tx.material.findUnique({ where: { id: input.materialId } });
    if (!material || !material.active) throw new AppError("Material não encontrado ou inativo.");
    const availableQty = await locationAvailable(tx, material.id, input.locationId);
    const request = await openReplenishment(tx, {
      material,
      locationId: input.locationId,
      availableQty,
      quantity: input.quantity,
      status: input.status,
      source: "MANUAL",
      priority: input.priority,
      userId: user.id,
      assigneeId: input.assigneeId,
      note: input.note,
    });
    return { id: request?.id };
  });
}

export async function changeReplenishmentStatus(
  user: SessionUser,
  requestId: string,
  status: ReplenishmentStatus,
  note?: string | null,
  outer?: Prisma.TransactionClient,
) {
  const run = async (tx: Prisma.TransactionClient) => {
    const request = await tx.replenishmentRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new AppError("Solicitação não encontrada.", 404);
    if (request.status === status) return { id: request.id, status };
    if (!canTransition(request.status, status)) {
      throw new AppError("Esta mudança de etapa não é permitida.");
    }
    const terminal = status === "REPLENISHED" || status === "CANCELLED";
    await tx.replenishmentRequest.update({
      where: { id: request.id },
      data: { status, closedAt: terminal ? new Date() : null, note: note ?? request.note },
    });
    await tx.replenishmentEvent.create({
      data: {
        requestId: request.id,
        fromStatus: request.status,
        toStatus: status,
        userId: user.id,
        note: note ?? null,
      },
    });
    if (terminal) {
      await tx.container.updateMany({
        where: {
          locationId: request.locationId,
          status: "IN_REPLENISHMENT",
          balances: { some: { materialId: request.materialId } },
        },
        data: { status: "ACTIVE" },
      });
    }
    await writeAudit(tx, {
      userId: user.id,
      action: "REPLENISHMENT_STATUS",
      entity: "ReplenishmentRequest",
      entityId: request.id,
      metadata: { from: request.status, to: status, stockChanged: false },
    });
    return { id: request.id, status };
  };
  if (outer) return run(outer);
  return prisma.$transaction(run);
}

export async function moveKanbanCard(_user: SessionUser, _cardId: string, _toColumn: KanbanColumnId) {
  throw new AppError("A etapa do Kanban acompanha o saldo. Registre uma movimentação para mudá-la.");
}

export type BoardCard = {
  id: string;
  column: KanbanColumnId;
  materialId: string;
  code: string;
  name: string;
  unit: string;
  imageUrl: string | null;
  availableQty: number;
  minStock: number;
  requestedQty: number | null;
  locationId: string;
  locationName: string;
  priority: Priority;
  requestedAt: string | null;
  assigneeName: string | null;
  critical: boolean;
  source: "AUTO" | "MANUAL" | null;
  note: string | null;
  requestId: string | null;
};

export async function getKanbanBoard(filters: {
  q?: string;
  categoryId?: string;
  locationId?: string;
  priority?: Priority;
}) {
  await closeRecoveredReplenishments();
  await ensureAutoReplenishments();
  const q = filters.q?.trim();
  const materials = await prisma.material.findMany({
    where: {
      active: true,
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      balances: { include: { location: true } },
      defaultLocation: true,
      requests: {
        where: {
          OR: [
            { status: { in: ["NEEDED", "REQUESTED", "IN_SUPPLY"] } },
            { status: "REPLENISHED" },
          ],
        },
        include: { location: true, assignee: true },
        orderBy: { openedAt: "desc" },
      },
    },
    orderBy: { code: "asc" },
  });

  const cards: BoardCard[] = [];
  for (const material of materials) {
    const locationIds = new Set<string>();
    for (const balance of material.balances) locationIds.add(balance.locationId);
    for (const request of material.requests) locationIds.add(request.locationId);
    if (material.defaultLocationId) locationIds.add(material.defaultLocationId);

    for (const locationId of locationIds) {
      if (filters.locationId && filters.locationId !== locationId) continue;
      const balances = material.balances.filter((balance) => balance.locationId === locationId);
      const availableQty = roundQty(
        balances.reduce((sum, balance) => sum + num(balance.onHand) - num(balance.reserved), 0),
      );
      const locationName =
        balances[0]?.location.name ||
        material.requests.find((request) => request.locationId === locationId)?.location.name ||
        material.defaultLocation?.name ||
        "Localização";
      const active = material.requests.find(
        (request) => request.locationId === locationId && ["NEEDED", "REQUESTED", "IN_SUPPLY"].includes(request.status),
      );
      const replenished = material.requests.find(
        (request) => request.locationId === locationId && request.status === "REPLENISHED",
      );
      const reorderPoint = num(material.reorderPoint);
      const waitingReceipt = !active && replenished && availableQty <= (reorderPoint > 0 ? reorderPoint : 0);
      const request = active || (waitingReceipt ? replenished : null);
      const column = kanbanStage({
        availableQty,
        maxStock: num(material.maxStock),
        reorderPoint,
        minStock: num(material.minStock),
      });
      const priority = request?.priority ?? (isCritical(availableQty, num(material.minStock)) ? "HIGH" : "LOW");
      if (filters.priority && priority !== filters.priority) continue;
      if (column === "AVAILABLE" && availableQty <= 0 && reorderPoint <= 0 && balances.length === 0 && !request) {
        continue;
      }
      cards.push({
        id: request ? `req:${request.id}` : `avail:${material.id}:${locationId}`,
        column,
        materialId: material.id,
        code: material.code,
        name: material.name,
        unit: material.unit,
        imageUrl: material.imageUrl,
        availableQty,
        minStock: num(material.minStock),
        requestedQty: request ? num(request.quantity) : null,
        locationId,
        locationName,
        priority,
        requestedAt: request ? request.openedAt.toISOString() : null,
        assigneeName: request?.assignee?.name ?? null,
        critical: isCritical(availableQty, num(material.minStock)),
        source: request?.source ?? null,
        note: request?.note ?? null,
        requestId: request?.id ?? null,
      });
    }
  }
  return cards;
}

export async function getReplenishment(id: string) {
  const request = await prisma.replenishmentRequest.findUnique({
    where: { id },
    include: {
      material: true,
      location: true,
      assignee: true,
      requestedBy: true,
      events: { include: { user: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!request) throw new AppError("Solicitação não encontrada.", 404);
  return {
    id: request.id,
    status: request.status,
    priority: request.priority,
    quantity: num(request.quantity),
    availableAtOpen: num(request.availableAtOpen),
    source: request.source,
    note: request.note,
    openedAt: request.openedAt.toISOString(),
    closedAt: request.closedAt?.toISOString() ?? null,
    material: { id: request.material.id, code: request.material.code, name: request.material.name },
    location: { id: request.location.id, code: request.location.code, name: request.location.name },
    assignee: request.assignee?.name ?? null,
    requestedBy: request.requestedBy?.name ?? "Sistema",
    events: request.events.map((event) => ({
      id: event.id,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      note: event.note,
      userName: event.user?.name ?? "Sistema",
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

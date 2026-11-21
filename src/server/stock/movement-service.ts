import { Prisma, type MovementType, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { num, roundQty } from "@/lib/numbers";
import { writeAudit } from "@/server/audit";
import { getSettings } from "@/server/settings";
import { syncAfterStockChange, triggerTwoBin } from "@/server/kanban/replenishment";
import { assertAdjustment, assertCanLeaveStock, assertQuantity } from "@/server/stock/rules";

type Db = Prisma.TransactionClient | PrismaClient;

export type MovementInput = {
  materialId: string;
  type: MovementType;
  quantity?: number;
  targetQuantity?: number;
  userId: string;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  fromContainerId?: string | null;
  toContainerId?: string | null;
  note?: string | null;
  idempotencyKey?: string | null;
};

function decimal(value: number) {
  return new Prisma.Decimal(roundQty(value).toFixed(3));
}

function containerKey(containerId?: string | null) {
  return containerId || "_";
}

async function lockMaterial(tx: Prisma.TransactionClient, materialId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${materialId}))`;
}

async function requireLocation(tx: Prisma.TransactionClient, locationId: string) {
  const location = await tx.location.findUnique({ where: { id: locationId } });
  if (!location || !location.active) throw new AppError("Localização inválida ou inativa.");
  return location;
}

async function requireContainer(tx: Prisma.TransactionClient, containerId: string, locationId: string) {
  const container = await tx.container.findUnique({ where: { id: containerId } });
  if (!container || !container.active) throw new AppError("Recipiente inválido ou inativo.");
  if (container.locationId !== locationId) {
    throw new AppError("O recipiente não está na localização informada.");
  }
  return container;
}

async function readBalance(
  tx: Prisma.TransactionClient,
  materialId: string,
  locationId: string,
  containerId?: string | null,
) {
  const row = await tx.stockBalance.findUnique({
    where: {
      materialId_locationId_containerKey: {
        materialId,
        locationId,
        containerKey: containerKey(containerId),
      },
    },
  });
  return {
    onHand: num(row?.onHand),
    reserved: num(row?.reserved),
  };
}

async function saveBalance(
  tx: Prisma.TransactionClient,
  input: {
    materialId: string;
    locationId: string;
    containerId?: string | null;
    onHand: number;
    reserved: number;
  },
) {
  const key = containerKey(input.containerId);
  await tx.stockBalance.upsert({
    where: {
      materialId_locationId_containerKey: {
        materialId: input.materialId,
        locationId: input.locationId,
        containerKey: key,
      },
    },
    create: {
      materialId: input.materialId,
      locationId: input.locationId,
      containerId: input.containerId || null,
      containerKey: key,
      onHand: decimal(input.onHand),
      reserved: decimal(input.reserved),
    },
    update: {
      onHand: decimal(input.onHand),
      reserved: decimal(input.reserved),
    },
  });
}

async function assertCapacity(
  tx: Prisma.TransactionClient,
  containerId: string,
  delta: number,
) {
  if (delta <= 0) return;
  const container = await tx.container.findUnique({ where: { id: containerId } });
  if (!container?.capacity) return;
  const rows = await tx.stockBalance.findMany({ where: { containerId } });
  const total = roundQty(rows.reduce((sum, row) => sum + num(row.onHand), 0) + delta);
  if (total > num(container.capacity) + 1e-9) {
    throw new AppError("A quantidade excede a capacidade do recipiente.");
  }
}

async function applyOnHand(
  tx: Prisma.TransactionClient,
  input: {
    materialId: string;
    locationId: string;
    containerId?: string | null;
    delta: number;
    allowNegative: boolean;
  },
) {
  if (input.containerId) await requireContainer(tx, input.containerId, input.locationId);
  await assertCapacity(tx, input.containerId || "", input.containerId ? input.delta : 0);
  const current = await readBalance(tx, input.materialId, input.locationId, input.containerId);
  const onHand = roundQty(current.onHand + input.delta);
  if (!input.allowNegative && onHand < -1e-9) {
    throw new AppError("A operação deixaria o estoque negativo.");
  }
  if (!input.allowNegative && onHand + 1e-9 < current.reserved) {
    throw new AppError("O saldo ficaria menor que a quantidade reservada.");
  }
  await saveBalance(tx, {
    materialId: input.materialId,
    locationId: input.locationId,
    containerId: input.containerId,
    onHand,
    reserved: current.reserved,
  });
  return onHand;
}

export async function registerMovement(input: MovementInput, outer?: Prisma.TransactionClient) {
  if (outer) return applyMovement(outer, input);
  try {
    return await prisma.$transaction((tx) => applyMovement(tx, input));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && input.idempotencyKey) {
      const existing = await prisma.movement.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return { movementId: existing.id, replayed: true };
    }
    throw error;
  }
}

async function applyMovement(tx: Prisma.TransactionClient, input: MovementInput) {
  if (input.idempotencyKey) {
    const existing = await tx.movement.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return { movementId: existing.id, replayed: true };
  }

  await lockMaterial(tx, input.materialId);
  const material = await tx.material.findUnique({ where: { id: input.materialId } });
  if (!material || !material.active) throw new AppError("Material não encontrado ou inativo.");

  const settings = await getSettings(tx);
  const affected = new Set<string>();
  let quantity = 0;
  let quantitySigned = 0;
  let fromLocationId = input.fromLocationId ?? null;
  let toLocationId = input.toLocationId ?? null;
  let fromContainerId = input.fromContainerId ?? null;
  let toContainerId = input.toContainerId ?? null;

  if (input.type === "IN" || input.type === "RETURN") {
    if (!toLocationId) throw new AppError("Informe a localização de destino.");
    await requireLocation(tx, toLocationId);
    if (toContainerId) await requireContainer(tx, toContainerId, toLocationId);
    quantity = roundQty(input.quantity ?? 0);
    assertQuantity(quantity);
    await applyOnHand(tx, {
      materialId: material.id,
      locationId: toLocationId,
      containerId: toContainerId,
      delta: quantity,
      allowNegative: settings.allowNegativeStock,
    });
    quantitySigned = quantity;
    affected.add(toLocationId);
    fromLocationId = null;
    fromContainerId = null;
  } else if (input.type === "OUT") {
    if (!fromLocationId) throw new AppError("Informe a localização de origem.");
    await requireLocation(tx, fromLocationId);
    if (fromContainerId) await requireContainer(tx, fromContainerId, fromLocationId);
    quantity = roundQty(input.quantity ?? 0);
    const current = await readBalance(tx, material.id, fromLocationId, fromContainerId);
    assertCanLeaveStock({
      onHand: current.onHand,
      reserved: current.reserved,
      quantity,
      allowNegative: settings.allowNegativeStock,
      purpose: "out",
    });
    await applyOnHand(tx, {
      materialId: material.id,
      locationId: fromLocationId,
      containerId: fromContainerId,
      delta: -quantity,
      allowNegative: settings.allowNegativeStock,
    });
    quantitySigned = -quantity;
    affected.add(fromLocationId);
    toLocationId = null;
    toContainerId = null;
    if (fromContainerId) {
      const updated = await readBalance(tx, material.id, fromLocationId, fromContainerId);
      await triggerTwoBin(tx, {
        containerId: fromContainerId,
        materialId: material.id,
        locationId: fromLocationId,
        onHand: updated.onHand,
        userId: input.userId,
      });
    }
  } else if (input.type === "RESERVE" || input.type === "RELEASE") {
    if (!fromLocationId) throw new AppError("Informe a localização da reserva.");
    await requireLocation(tx, fromLocationId);
    if (fromContainerId) await requireContainer(tx, fromContainerId, fromLocationId);
    quantity = roundQty(input.quantity ?? 0);
    assertQuantity(quantity);
    const current = await readBalance(tx, material.id, fromLocationId, fromContainerId);
    if (input.type === "RESERVE") {
      assertCanLeaveStock({
        onHand: current.onHand,
        reserved: current.reserved,
        quantity,
        allowNegative: settings.allowNegativeStock,
        purpose: "reserve",
      });
    } else if (quantity > current.reserved + 1e-9) {
      throw new AppError("A liberação é maior que a quantidade reservada.");
    }
    const reserved =
      input.type === "RESERVE" ? roundQty(current.reserved + quantity) : roundQty(current.reserved - quantity);
    await saveBalance(tx, {
      materialId: material.id,
      locationId: fromLocationId,
      containerId: fromContainerId,
      onHand: current.onHand,
      reserved,
    });
    quantitySigned = 0;
    affected.add(fromLocationId);
    toLocationId = null;
    toContainerId = null;
  } else if (input.type === "TRANSFER") {
    if (!fromLocationId || !toLocationId) throw new AppError("Informe a origem e o destino da transferência.");
    if (fromLocationId === toLocationId && (fromContainerId || null) === (toContainerId || null)) {
      throw new AppError("A origem e o destino da transferência são iguais.");
    }
    await requireLocation(tx, fromLocationId);
    await requireLocation(tx, toLocationId);
    if (fromContainerId) await requireContainer(tx, fromContainerId, fromLocationId);
    if (toContainerId) await requireContainer(tx, toContainerId, toLocationId);
    quantity = roundQty(input.quantity ?? 0);
    const current = await readBalance(tx, material.id, fromLocationId, fromContainerId);
    assertCanLeaveStock({
      onHand: current.onHand,
      reserved: current.reserved,
      quantity,
      allowNegative: false,
      purpose: "out",
    });
    await applyOnHand(tx, {
      materialId: material.id,
      locationId: fromLocationId,
      containerId: fromContainerId,
      delta: -quantity,
      allowNegative: false,
    });
    await applyOnHand(tx, {
      materialId: material.id,
      locationId: toLocationId,
      containerId: toContainerId,
      delta: quantity,
      allowNegative: settings.allowNegativeStock,
    });
    quantitySigned = 0;
    affected.add(fromLocationId);
    affected.add(toLocationId);
    if (fromContainerId) {
      const updated = await readBalance(tx, material.id, fromLocationId, fromContainerId);
      await triggerTwoBin(tx, {
        containerId: fromContainerId,
        materialId: material.id,
        locationId: fromLocationId,
        onHand: updated.onHand,
        userId: input.userId,
      });
    }
  } else if (input.type === "ADJUSTMENT") {
    const locationId = toLocationId || fromLocationId;
    const containerId = toContainerId || fromContainerId;
    if (!locationId) throw new AppError("Informe a localização do inventário.");
    await requireLocation(tx, locationId);
    if (containerId) await requireContainer(tx, containerId, locationId);
    const current = await readBalance(tx, material.id, locationId, containerId);
    const planned = assertAdjustment({
      onHand: current.onHand,
      reserved: current.reserved,
      target: input.targetQuantity ?? Number.NaN,
      allowNegative: settings.allowNegativeStock,
    });
    if (containerId && planned.delta > 0) await assertCapacity(tx, containerId, planned.delta);
    await saveBalance(tx, {
      materialId: material.id,
      locationId,
      containerId,
      onHand: planned.target,
      reserved: current.reserved,
    });
    quantity = Math.abs(planned.delta);
    quantitySigned = planned.delta;
    fromLocationId = locationId;
    toLocationId = locationId;
    fromContainerId = containerId ?? null;
    toContainerId = containerId ?? null;
    affected.add(locationId);
  } else {
    throw new AppError("Tipo de movimentação inválido.");
  }

  const movement = await tx.movement.create({
    data: {
      materialId: material.id,
      type: input.type,
      quantity: decimal(quantity),
      quantitySigned: decimal(quantitySigned),
      userId: input.userId,
      fromLocationId,
      toLocationId,
      fromContainerId,
      toContainerId,
      note: input.note ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
    },
  });

  await tx.material.update({
    where: { id: material.id },
    data: { lastMovementAt: new Date() },
  });

  await syncAfterStockChange(tx, material.id, [...affected], input.userId);
  await writeAudit(tx, {
    userId: input.userId,
    action: `MOVEMENT_${input.type}`,
    entity: "Movement",
    entityId: movement.id,
    metadata: { materialId: material.id, quantity, quantitySigned },
  });

  return { movementId: movement.id, replayed: false };
}

export async function listBalances(filters: { q?: string; locationId?: string; page: number; pageSize: number }) {
  const q = filters.q?.trim();
  const where: Prisma.StockBalanceWhereInput = {
    ...(filters.locationId ? { locationId: filters.locationId } : {}),
    ...(q
      ? {
          material: {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.stockBalance.count({ where }),
    prisma.stockBalance.findMany({
      where,
      include: { material: true, location: true, container: true },
      orderBy: [{ material: { code: "asc" } }, { location: { code: "asc" } }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);
  return {
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    items: rows.map((row) => ({
      id: row.id,
      materialId: row.materialId,
      code: row.material.code,
      name: row.material.name,
      unit: row.material.unit,
      locationId: row.locationId,
      locationName: row.location.name,
      containerId: row.containerId,
      containerCode: row.container?.code ?? null,
      onHand: num(row.onHand),
      reserved: num(row.reserved),
      available: roundQty(num(row.onHand) - num(row.reserved)),
    })),
  };
}

export async function listMovements(filters: {
  materialId?: string;
  type?: MovementType;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.MovementWhereInput = {
    ...(filters.materialId ? { materialId: filters.materialId } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.from || filters.to
      ? { createdAt: { gte: filters.from, lte: filters.to } }
      : {}),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.movement.count({ where }),
    prisma.movement.findMany({
      where,
      include: {
        material: true,
        user: true,
        fromLocation: true,
        toLocation: true,
        fromContainer: true,
        toContainer: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);
  return {
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    items: rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      type: row.type,
      quantity: num(row.quantity),
      quantitySigned: num(row.quantitySigned),
      note: row.note,
      materialId: row.materialId,
      code: row.material.code,
      name: row.material.name,
      unit: row.material.unit,
      userName: row.user?.name ?? "Usuário removido",
      fromLocation: row.fromLocation?.code ?? null,
      toLocation: row.toLocation?.code ?? null,
      fromContainer: row.fromContainer?.code ?? null,
      toContainer: row.toContainer?.code ?? null,
    })),
  };
}

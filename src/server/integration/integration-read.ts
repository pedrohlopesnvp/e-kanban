import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { num } from "@/lib/numbers";
import { safeEqual } from "@/server/auth/session";
import { getSettings } from "@/server/settings";

export async function authorizeIntegration(request: Request) {
  const settings = await getSettings();
  if (!settings.integrationEnabled || !settings.integrationApiKey) {
    throw new AppError(
      "A integração ERP está desativada. O contrato existe, mas nenhum sistema externo está conectado.",
      403,
      "INTEGRATION_DISABLED",
    );
  }
  const key = request.headers.get("x-api-key") || "";
  if (!safeEqual(key, settings.integrationApiKey)) {
    throw new AppError("Chave de integração inválida.", 401, "INTEGRATION_UNAUTHORIZED");
  }
}

export async function integrationMaterials() {
  const materials = await prisma.material.findMany({
    include: { category: true, supplier: true, defaultLocation: true },
    orderBy: { code: "asc" },
  });
  return materials.map((material) => ({
    code: material.code,
    name: material.name,
    description: material.description,
    unit: material.unit,
    category: material.category?.name ?? null,
    supplierCode: material.supplier?.code ?? null,
    locationCode: material.defaultLocation?.code ?? null,
    active: material.active,
    updatedAt: material.updatedAt.toISOString(),
  }));
}

export async function integrationStock() {
  const balances = await prisma.stockBalance.findMany({
    include: { material: true, location: true, container: true },
    orderBy: [{ material: { code: "asc" } }],
  });
  return balances.map((balance) => ({
    materialCode: balance.material.code,
    locationCode: balance.location.code,
    containerCode: balance.container?.code ?? null,
    onHand: num(balance.onHand),
    reserved: num(balance.reserved),
    available: num(balance.onHand) - num(balance.reserved),
  }));
}

export async function integrationReplenishments() {
  const requests = await prisma.replenishmentRequest.findMany({
    where: { status: { in: ["NEEDED", "REQUESTED", "IN_SUPPLY"] } },
    include: { material: true, location: true },
    orderBy: { openedAt: "asc" },
  });
  return requests.map((request) => ({
    id: request.id,
    materialCode: request.material.code,
    locationCode: request.location.code,
    status: request.status,
    priority: request.priority,
    quantity: num(request.quantity),
    openedAt: request.openedAt.toISOString(),
  }));
}

export async function integrationMovements(from?: Date) {
  const movements = await prisma.movement.findMany({
    where: from ? { createdAt: { gte: from } } : {},
    include: { material: true, fromLocation: true, toLocation: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return movements.map((movement) => ({
    id: movement.id,
    materialCode: movement.material.code,
    type: movement.type,
    quantity: num(movement.quantity),
    quantitySigned: num(movement.quantitySigned),
    fromLocation: movement.fromLocation?.code ?? null,
    toLocation: movement.toLocation?.code ?? null,
    createdAt: movement.createdAt.toISOString(),
  }));
}

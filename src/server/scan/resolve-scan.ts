import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { num, roundQty } from "@/lib/numbers";
import { kanbanStage } from "@/lib/kanban-stage";

const materialInclude = {
  category: true,
  subcategory: true,
  supplier: true,
  defaultLocation: true,
  balances: { include: { location: true, container: true } },
} as const;

function tokenFrom(value: string) {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const marker = parts.indexOf("q");
    if (marker >= 0 && parts[marker + 1]) return decodeURIComponent(parts[marker + 1]);
  } catch {
    return null;
  }
  return null;
}

function mapMaterial(
  material: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    barcode: string | null;
    imageUrl: string | null;
    unit: string;
    minStock: { toString(): string };
    maxStock: { toString(): string };
    reorderPoint: { toString(): string };
    reorderQty: { toString(): string };
    unitCost: { toString(): string };
    active: boolean;
    defaultLocationId: string | null;
    category: { name: string } | null;
    subcategory: { name: string } | null;
    supplier: { name: string } | null;
    defaultLocation: { name: string } | null;
    balances: {
      locationId: string;
      onHand: { toString(): string };
      reserved: { toString(): string };
      containerId: string | null;
      location: { name: string };
      container: { code: string } | null;
    }[];
  },
  locations: { id: string; name: string }[],
) {
  const minStock = num(material.minStock);
  const maxStock = num(material.maxStock);
  const reorderPoint = num(material.reorderPoint);
  const balances = material.balances.map((balance) => ({
    locationId: balance.locationId,
    locationName: balance.location.name,
    containerId: balance.containerId,
    containerCode: balance.container?.code ?? null,
    onHand: num(balance.onHand),
    reserved: num(balance.reserved),
    available: roundQty(num(balance.onHand) - num(balance.reserved)),
  }));
  const available = roundQty(balances.reduce((sum, balance) => sum + balance.available, 0));
  const onHand = roundQty(balances.reduce((sum, balance) => sum + balance.onHand, 0));
  const reserved = roundQty(balances.reduce((sum, balance) => sum + balance.reserved, 0));
  return {
    kind: "material" as const,
    id: material.id,
    code: material.code,
    name: material.name,
    description: material.description,
    barcode: material.barcode,
    imageUrl: material.imageUrl,
    unit: material.unit,
    category: material.category?.name ?? null,
    subcategory: material.subcategory?.name ?? null,
    supplier: material.supplier?.name ?? null,
    minStock,
    maxStock,
    reorderPoint,
    reorderQty: num(material.reorderQty),
    unitCost: num(material.unitCost),
    active: material.active,
    defaultLocationId: material.defaultLocationId,
    defaultLocationName: material.defaultLocation?.name ?? null,
    available,
    onHand,
    reserved,
    stage: kanbanStage({ availableQty: available, maxStock, reorderPoint, minStock }),
    locations,
    balances,
  };
}

export async function resolveScannedCode(raw: string) {
  const value = raw.trim();
  if (!value) throw new AppError("Código vazio.");
  const token = tokenFrom(value);
  const locations = await prisma.location.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const material = await prisma.material.findFirst({
    where: {
      OR: [
        ...(token ? [{ publicToken: token }] : []),
        { barcode: value },
        { code: { equals: value, mode: "insensitive" } },
        { publicToken: value },
      ],
    },
    include: materialInclude,
  });
  if (material) return mapMaterial(material, locations);

  const container = await prisma.container.findFirst({
    where: {
      OR: [
        ...(token ? [{ publicToken: token }] : []),
        { code: { equals: value, mode: "insensitive" } },
        { publicToken: value },
      ],
    },
    include: { location: true, balances: { include: { material: true } } },
  });
  if (!container) throw new AppError("Código não reconhecido.", 404);
  return {
    kind: "container" as const,
    id: container.id,
    code: container.code,
    description: container.description,
    locationName: container.location.name,
    type: container.type,
    binRole: container.binRole,
    items: container.balances.map((balance) => ({
      materialId: balance.materialId,
      code: balance.material.code,
      name: balance.material.name,
      unit: balance.material.unit,
      available: roundQty(num(balance.onHand) - num(balance.reserved)),
    })),
  };
}

import { prisma } from "@/lib/db";
import { num, roundQty } from "@/lib/numbers";

function startOfRange(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (days - 1));
  return date;
}

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}

function fillDays(days: number) {
  const start = startOfRange(days);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return dayKey(date);
  });
}

export async function getDashboard(days: number) {
  const period = [7, 30, 90].includes(days) ? days : 30;
  const from = startOfRange(period);
  const [materials, openRequests, doneRequests, recent, categories, movementRows, requestRows, consumption] =
    await Promise.all([
      prisma.$queryRaw<
        { id: string; active: boolean; minStock: number; unitCost: number; onHand: number; available: number }[]
      >`
        SELECT m.id, m.active,
               m."minStock"::float8 AS "minStock",
               m."unitCost"::float8 AS "unitCost",
               COALESCE(SUM(b."onHand"), 0)::float8 AS "onHand",
               COALESCE(SUM(b."onHand" - b.reserved), 0)::float8 AS available
        FROM "Material" m
        LEFT JOIN "StockBalance" b ON b."materialId" = m.id
        GROUP BY m.id
      `,
      prisma.replenishmentRequest.count({ where: { status: { in: ["NEEDED", "REQUESTED", "IN_SUPPLY"] } } }),
      prisma.replenishmentRequest.count({ where: { status: "REPLENISHED" } }),
      prisma.movement.findMany({
        include: { material: true, user: true },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.$queryRaw<{ name: string; total: number }[]>`
        SELECT COALESCE(c.name, 'Sem categoria') AS name, COUNT(*)::int AS total
        FROM "Material" m
        LEFT JOIN "Category" c ON c.id = m."categoryId"
        WHERE m.active = true
        GROUP BY 1
        ORDER BY total DESC
      `,
      prisma.$queryRaw<{ day: string; entradas: number; saidas: number }[]>`
        SELECT to_char(mv."createdAt" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS day,
               COALESCE(SUM(CASE WHEN mv.type IN ('IN', 'RETURN') THEN mv.quantity ELSE 0 END), 0)::float8 AS entradas,
               COALESCE(SUM(CASE WHEN mv.type = 'OUT' THEN mv.quantity ELSE 0 END), 0)::float8 AS saidas
        FROM "Movement" mv
        WHERE mv."createdAt" >= ${from}
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.$queryRaw<{ day: string; total: number }[]>`
        SELECT to_char("openedAt" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS total
        FROM "ReplenishmentRequest"
        WHERE "openedAt" >= ${from}
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.$queryRaw<{ code: string; name: string; quantity: number }[]>`
        SELECT m.code, m.name, SUM(mv.quantity)::float8 AS quantity
        FROM "Movement" mv
        JOIN "Material" m ON m.id = mv."materialId"
        WHERE mv.type = 'OUT' AND mv."createdAt" >= ${from}
        GROUP BY m.id
        ORDER BY quantity DESC
        LIMIT 5
      `,
    ]);

  const active = materials.filter((item) => item.active);
  const outOfStock = active.filter((item) => item.available <= 0).length;
  const belowMin = active.filter(
    (item) => item.available > 0 && item.minStock > 0 && item.available <= item.minStock,
  ).length;
  const adequate = active.filter((item) => item.available > 0 && (item.minStock <= 0 || item.available > item.minStock)).length;
  const stockValue = roundQty(
    active.reduce((sum, item) => sum + num(item.onHand) * num(item.unitCost), 0),
  );
  const daysAxis = fillDays(period);
  const movementMap = new Map(movementRows.map((row) => [row.day, row]));
  const requestMap = new Map(requestRows.map((row) => [row.day, row.total]));

  return {
    period,
    totals: {
      materials: materials.length,
      active: active.length,
      adequate,
      belowMin,
      outOfStock,
      openRequests,
      doneRequests,
      stockValue,
    },
    categories,
    situations: [
      { name: "Adequado", total: adequate, fill: "#3b82f6" },
      { name: "Abaixo do mínimo", total: belowMin, fill: "#eab308" },
      { name: "Sem estoque", total: outOfStock, fill: "#ef4444" },
    ],
    flow: daysAxis.map((day) => ({
      day: day.slice(5),
      entradas: roundQty(movementMap.get(day)?.entradas ?? 0),
      saidas: roundQty(movementMap.get(day)?.saidas ?? 0),
    })),
    requests: daysAxis.map((day) => ({ day: day.slice(5), total: requestMap.get(day) ?? 0 })),
    consumption: consumption.map((item) => ({ ...item, quantity: roundQty(item.quantity) })),
    recent: recent.map((movement) => ({
      id: movement.id,
      type: movement.type,
      quantity: num(movement.quantity),
      unit: movement.material.unit,
      code: movement.material.code,
      name: movement.material.name,
      userName: movement.user?.name ?? "Usuário removido",
      createdAt: movement.createdAt.toISOString(),
    })),
  };
}

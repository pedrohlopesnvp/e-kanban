import { Prisma } from "@prisma/client";
import Papa from "papaparse";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { num, roundQty } from "@/lib/numbers";
import { writeAudit } from "@/server/audit";
import type { SessionUser } from "@/server/auth/session";
import { ensureAutoReplenishments } from "@/server/kanban/replenishment";
import type { z } from "zod";
import { materialSchema } from "@/server/validators";

type MaterialInput = z.infer<typeof materialSchema>;

export type MaterialListQuery = {
  q?: string;
  categoryId?: string;
  availability?: string;
  active?: string;
  sort?: string;
  dir?: string;
  page: number;
  pageSize: number;
};

function appUrl() {
  return process.env.APP_URL || "http://localhost:3000";
}

function like(value: string) {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

async function assertRelations(input: MaterialInput, currentId?: string) {
  const code = input.code.trim().toUpperCase();
  const duplicated = await prisma.material.findFirst({
    where: { code, ...(currentId ? { NOT: { id: currentId } } : {}) },
  });
  if (duplicated) throw new AppError("Já existe um material com este código.", 409, "DUPLICATE");
  if (input.barcode) {
    const barcode = await prisma.material.findFirst({
      where: { barcode: input.barcode, ...(currentId ? { NOT: { id: currentId } } : {}) },
    });
    if (barcode) throw new AppError("Já existe um material com este código de barras.", 409, "DUPLICATE");
  }
  if (input.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category || !category.active || category.parentId) {
      throw new AppError("Selecione uma categoria válida.");
    }
  }
  if (input.subcategoryId) {
    const subcategory = await prisma.category.findUnique({ where: { id: input.subcategoryId } });
    if (!subcategory || !subcategory.active || subcategory.parentId !== input.categoryId) {
      throw new AppError("A subcategoria não pertence à categoria selecionada.");
    }
  }
  if (input.defaultLocationId) {
    const location = await prisma.location.findUnique({ where: { id: input.defaultLocationId } });
    if (!location || !location.active) throw new AppError("Localização padrão inválida.");
  }
  if (input.supplierId) {
    const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } });
    if (!supplier || !supplier.active) throw new AppError("Fornecedor inválido.");
  }
  return code;
}

function materialData(input: MaterialInput, code: string) {
  return {
    code,
    name: input.name.trim(),
    description: input.description,
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId,
    barcode: input.barcode,
    imageUrl: input.imageUrl,
    unit: input.unit.trim().toUpperCase(),
    minStock: new Prisma.Decimal(input.minStock.toFixed(3)),
    maxStock: new Prisma.Decimal(input.maxStock.toFixed(3)),
    reorderPoint: new Prisma.Decimal(input.reorderPoint.toFixed(3)),
    reorderQty: new Prisma.Decimal(input.reorderQty.toFixed(3)),
    defaultLocationId: input.defaultLocationId,
    supplierId: input.supplierId,
    supplierCode: input.supplierCode,
    unitCost: new Prisma.Decimal(input.unitCost.toFixed(4)),
    active: input.active,
  };
}

export async function createMaterial(user: SessionUser, input: MaterialInput) {
  const code = await assertRelations(input);
  const material = await prisma.material.create({ data: materialData(input, code) });
  await writeAudit(prisma, {
    userId: user.id,
    action: "MATERIAL_CREATE",
    entity: "Material",
    entityId: material.id,
  });
  await ensureAutoReplenishments();
  return { id: material.id };
}

export async function updateMaterial(user: SessionUser, id: string, input: MaterialInput) {
  const current = await prisma.material.findUnique({ where: { id } });
  if (!current) throw new AppError("Material não encontrado.", 404);
  if (current.active && !input.active) {
    const stock = await prisma.stockBalance.aggregate({ where: { materialId: id }, _sum: { onHand: true } });
    if (num(stock._sum.onHand) > 0) {
      throw new AppError("Zere o estoque antes de desativar o material. O histórico é preservado.");
    }
  }
  const code = await assertRelations(input, id);
  await prisma.material.update({ where: { id }, data: materialData(input, code) });
  await writeAudit(prisma, { userId: user.id, action: "MATERIAL_UPDATE", entity: "Material", entityId: id });
  await ensureAutoReplenishments();
  return { id };
}

export async function listMaterials(query: MaterialListQuery) {
  const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (query.q?.trim()) {
    const pattern = like(query.q.trim());
    conditions.push(
      Prisma.sql`(m.code ILIKE ${pattern} ESCAPE '\\' OR m.name ILIKE ${pattern} ESCAPE '\\' OR COALESCE(m.barcode, '') ILIKE ${pattern} ESCAPE '\\')`,
    );
  }
  if (query.categoryId) conditions.push(Prisma.sql`m."categoryId" = ${query.categoryId}`);
  if (query.active === "true") conditions.push(Prisma.sql`m.active = true`);
  if (query.active === "false") conditions.push(Prisma.sql`m.active = false`);
  const available = Prisma.sql`COALESCE(SUM(b."onHand" - b.reserved), 0)`;
  const having =
    query.availability === "OUT"
      ? Prisma.sql`HAVING ${available} <= 0`
      : query.availability === "LOW"
        ? Prisma.sql`HAVING ${available} > 0 AND ${available} <= m."minStock" AND m."minStock" > 0`
        : query.availability === "REORDER"
          ? Prisma.sql`HAVING ${available} <= m."reorderPoint" AND m."reorderPoint" > 0`
          : query.availability === "OK"
            ? Prisma.sql`HAVING ${available} > 0 AND (m."minStock" <= 0 OR ${available} > m."minStock")`
            : Prisma.empty;
  const sortColumns: Record<string, Prisma.Sql> = {
    code: Prisma.sql`m.code`,
    name: Prisma.sql`m.name`,
    available: Prisma.sql`available`,
    cost: Prisma.sql`m."unitCost"`,
  };
  const sort = sortColumns[query.sort || "name"] ?? sortColumns.name;
  const direction = query.dir === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  const where = Prisma.join(conditions, " AND ");
  const rows = await prisma.$queryRaw<
    {
      id: string;
      code: string;
      name: string;
      unit: string;
      active: boolean;
      minStock: number;
      reorderPoint: number;
      unitCost: number;
      imageUrl: string | null;
      categoryName: string | null;
      available: number;
      onHand: number;
    }[]
  >`
    SELECT m.id, m.code, m.name, m.unit, m.active,
           m."minStock"::float8 AS "minStock",
           m."reorderPoint"::float8 AS "reorderPoint",
           m."unitCost"::float8 AS "unitCost",
           m."imageUrl" AS "imageUrl",
           c.name AS "categoryName",
           ${available}::float8 AS available,
           COALESCE(SUM(b."onHand"), 0)::float8 AS "onHand"
    FROM "Material" m
    LEFT JOIN "Category" c ON c.id = m."categoryId"
    LEFT JOIN "StockBalance" b ON b."materialId" = m.id
    WHERE ${where}
    GROUP BY m.id, c.name
    ${having}
    ORDER BY ${sort} ${direction}
    LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}
  `;
  const totalRows = await prisma.$queryRaw<{ total: number }[]>`
    SELECT COUNT(*)::int AS total FROM (
      SELECT m.id
      FROM "Material" m
      LEFT JOIN "StockBalance" b ON b."materialId" = m.id
      WHERE ${where}
      GROUP BY m.id
      ${having}
    ) counted
  `;
  return {
    total: totalRows[0]?.total ?? 0,
    page: query.page,
    pageSize: query.pageSize,
    items: rows.map((row) => ({ ...row, available: roundQty(row.available), onHand: roundQty(row.onHand) })),
  };
}

export async function getMaterial(id: string) {
  const material = await prisma.material.findUnique({
    where: { id },
    include: {
      category: true,
      subcategory: true,
      supplier: true,
      defaultLocation: true,
      balances: { include: { location: true, container: true }, orderBy: { location: { code: "asc" } } },
      movements: {
        include: { user: true, fromLocation: true, toLocation: true },
        orderBy: { createdAt: "desc" },
        take: 30,
      },
      requests: {
        include: { location: true, events: { include: { user: true }, orderBy: { createdAt: "desc" }, take: 12 } },
        orderBy: { openedAt: "desc" },
        take: 8,
      },
    },
  });
  if (!material) throw new AppError("Material não encontrado.", 404);
  const onHand = roundQty(material.balances.reduce((sum, balance) => sum + num(balance.onHand), 0));
  const reserved = roundQty(material.balances.reduce((sum, balance) => sum + num(balance.reserved), 0));
  return {
    ...material,
    minStock: num(material.minStock),
    maxStock: num(material.maxStock),
    reorderPoint: num(material.reorderPoint),
    reorderQty: num(material.reorderQty),
    unitCost: num(material.unitCost),
    onHand,
    reserved,
    available: roundQty(onHand - reserved),
    qrUrl: `${appUrl()}/q/${material.publicToken}`,
    balances: material.balances.map((balance) => ({
      id: balance.id,
      locationId: balance.locationId,
      locationName: balance.location.name,
      locationCode: balance.location.code,
      containerId: balance.containerId,
      containerCode: balance.container?.code ?? null,
      onHand: num(balance.onHand),
      reserved: num(balance.reserved),
      available: roundQty(num(balance.onHand) - num(balance.reserved)),
    })),
    movements: material.movements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      quantity: num(movement.quantity),
      quantitySigned: num(movement.quantitySigned),
      note: movement.note,
      userName: movement.user?.name ?? "Usuário removido",
      fromLocation: movement.fromLocation?.code ?? null,
      toLocation: movement.toLocation?.code ?? null,
      createdAt: movement.createdAt.toISOString(),
    })),
    requests: material.requests.map((request) => ({
      id: request.id,
      status: request.status,
      priority: request.priority,
      quantity: num(request.quantity),
      locationName: request.location.name,
      openedAt: request.openedAt.toISOString(),
      events: request.events.map((event) => ({
        id: event.id,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        note: event.note,
        userName: event.user?.name ?? "Sistema",
        createdAt: event.createdAt.toISOString(),
      })),
    })),
  };
}

export async function materialQr(tokenOrId: string) {
  const material = await prisma.material.findFirst({
    where: { OR: [{ publicToken: tokenOrId }, { id: tokenOrId }] },
  });
  if (!material) throw new AppError("Material não encontrado.", 404);
  const url = `${appUrl()}/q/${material.publicToken}`;
  const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 320 });
  return { url, dataUrl };
}

const csvColumns = [
  "codigo",
  "nome",
  "descricao",
  "categoria",
  "subcategoria",
  "codigo_barras",
  "unidade",
  "estoque_minimo",
  "estoque_maximo",
  "ponto_reposicao",
  "quantidade_reposicao",
  "localizacao",
  "fornecedor",
  "codigo_fornecedor",
  "custo",
  "ativo",
] as const;

export async function exportMaterialsCsv() {
  const materials = await prisma.material.findMany({
    include: { category: true, subcategory: true, supplier: true, defaultLocation: true },
    orderBy: { code: "asc" },
  });
  const rows = materials.map((material) => ({
    codigo: material.code,
    nome: material.name,
    descricao: material.description ?? "",
    categoria: material.category?.name ?? "",
    subcategoria: material.subcategory?.name ?? "",
    codigo_barras: material.barcode ?? "",
    unidade: material.unit,
    estoque_minimo: num(material.minStock),
    estoque_maximo: num(material.maxStock),
    ponto_reposicao: num(material.reorderPoint),
    quantidade_reposicao: num(material.reorderQty),
    localizacao: material.defaultLocation?.code ?? "",
    fornecedor: material.supplier?.code ?? "",
    codigo_fornecedor: material.supplierCode ?? "",
    custo: num(material.unitCost),
    ativo: material.active ? "sim" : "nao",
  }));
  return Papa.unparse({ fields: [...csvColumns], data: rows });
}

export async function importMaterialsCsv(user: SessionUser, text: string) {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    throw new AppError("Não foi possível ler o CSV.");
  }
  const categories = await prisma.category.findMany();
  const locations = await prisma.location.findMany();
  const suppliers = await prisma.supplier.findMany();
  const errors: { line: number; message: string }[] = [];
  let created = 0;
  for (const [index, row] of parsed.data.entries()) {
    const line = index + 2;
    try {
      const category = categories.find(
        (item) => item.name.toLowerCase() === (row.categoria || "").trim().toLowerCase() && !item.parentId,
      );
      const subcategory = categories.find(
        (item) =>
          item.name.toLowerCase() === (row.subcategoria || "").trim().toLowerCase() &&
          item.parentId === category?.id,
      );
      const location = locations.find((item) => item.code.toLowerCase() === (row.localizacao || "").trim().toLowerCase());
      const supplier = suppliers.find((item) => item.code.toLowerCase() === (row.fornecedor || "").trim().toLowerCase());
      const input = materialSchema.parse({
        code: row.codigo || "",
        name: row.nome || "",
        description: row.descricao || null,
        categoryId: category?.id ?? null,
        subcategoryId: subcategory?.id ?? null,
        barcode: row.codigo_barras || null,
        unit: row.unidade || "UN",
        minStock: Number(row.estoque_minimo || 0),
        maxStock: Number(row.estoque_maximo || 0),
        reorderPoint: Number(row.ponto_reposicao || 0),
        reorderQty: Number(row.quantidade_reposicao || 0),
        defaultLocationId: location?.id ?? null,
        supplierId: supplier?.id ?? null,
        supplierCode: row.codigo_fornecedor || null,
        unitCost: Number(row.custo || 0),
        active: (row.ativo || "sim").toLowerCase() !== "nao",
      });
      if ((row.categoria || "").trim() && !category) throw new AppError("Categoria não encontrada.");
      if ((row.subcategoria || "").trim() && !subcategory) throw new AppError("Subcategoria não encontrada.");
      if ((row.localizacao || "").trim() && !location) throw new AppError("Localização não encontrada.");
      if ((row.fornecedor || "").trim() && !supplier) throw new AppError("Fornecedor não encontrado.");
      await createMaterial(user, input);
      created += 1;
    } catch (error) {
      errors.push({ line, message: error instanceof Error ? error.message : "Linha inválida." });
    }
  }
  return { created, errors };
}

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { registerMovement } from "../src/server/stock/movement-service";
import { changeReplenishmentStatus, createManualReplenishment, ensureAutoReplenishments } from "../src/server/kanban/replenishment";

const prisma = new PrismaClient();

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(9, 30, 0, 0);
  return date;
}

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.replenishmentEvent.deleteMany();
  await prisma.replenishmentRequest.deleteMany();
  await prisma.movement.deleteMany();
  await prisma.stockBalance.deleteMany();
  await prisma.session.deleteMany();
  await prisma.material.deleteMany();
  await prisma.container.deleteMany();
  await prisma.category.deleteMany({ where: { parentId: { not: null } } });
  await prisma.category.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.location.deleteMany();
  await prisma.user.deleteMany();
  await prisma.setting.deleteMany();

  const password = async (value: string) => bcrypt.hash(value, 10);
  const [admin, operator, viewer] = await Promise.all([
    prisma.user.create({ data: { name: "Ana Admin", email: "admin@ekanban.local", passwordHash: await password("Admin@123"), role: "ADMIN" } }),
    prisma.user.create({ data: { name: "Bruno Operador", email: "operador@ekanban.local", passwordHash: await password("Operador@123"), role: "OPERATOR" } }),
    prisma.user.create({ data: { name: "Carla Visualizadora", email: "visualizador@ekanban.local", passwordHash: await password("Visual@123"), role: "VIEWER" } }),
  ]);

  const fixacao = await prisma.category.create({ data: { name: "Fixação", description: "Elementos de união" } });
  const parafusos = await prisma.category.create({ data: { name: "Parafusos", parentId: fixacao.id } });
  const porcas = await prisma.category.create({ data: { name: "Porcas e arruelas", parentId: fixacao.id } });
  const rolamentos = await prisma.category.create({ data: { name: "Rolamentos" } });
  const eletrica = await prisma.category.create({ data: { name: "Elétrica" } });
  const protecao = await prisma.category.create({ data: { name: "Proteção", parentId: eletrica.id } });
  const vedacao = await prisma.category.create({ data: { name: "Vedação" } });
  const lubrificacao = await prisma.category.create({ data: { name: "Lubrificação" } });

  const metalFix = await prisma.supplier.create({ data: { name: "MetalFix Indústria", code: "MFX", email: "vendas@metalfix.example", phone: "11 4000-1000" } });
  const rolamais = await prisma.supplier.create({ data: { name: "Rolamais", code: "RLM", email: "contato@rolamais.example" } });
  const eletroSul = await prisma.supplier.create({ data: { name: "EletroSul", code: "ELS", phone: "41 3333-2200" } });

  const almox = await prisma.location.create({ data: { code: "ALM-01", name: "Almoxarifado central", description: "Prédio 2" } });
  const oficina = await prisma.location.create({ data: { code: "OFC-01", name: "Oficina mecânica" } });

  const working = await prisma.container.create({
    data: { code: "CX-A1", type: "BOX", locationId: almox.id, description: "Caixa em uso do par M6", pairGroup: "PAR-M6", binRole: "WORKING", capacity: 200 },
  });
  const trigger = await prisma.container.create({
    data: { code: "CX-A2", type: "BOX", locationId: almox.id, description: "Caixa de disparo do par M6", pairGroup: "PAR-M6", binRole: "TRIGGER", capacity: 200 },
  });
  await prisma.container.create({ data: { code: "GV-04", type: "DRAWER", locationId: oficina.id, description: "Gaveta de rolamentos", capacity: 40 } });

  const material = async (data: {
    code: string;
    name: string;
    description: string;
    categoryId: string;
    subcategoryId?: string;
    unit?: string;
    min: number;
    max: number;
    point: number;
    qty: number;
    locationId: string;
    supplierId?: string;
    supplierCode?: string;
    cost: number;
    barcode?: string;
  }) =>
    prisma.material.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId,
        unit: data.unit || "UN",
        minStock: data.min,
        maxStock: data.max,
        reorderPoint: data.point,
        reorderQty: data.qty,
        defaultLocationId: data.locationId,
        supplierId: data.supplierId,
        supplierCode: data.supplierCode,
        unitCost: data.cost,
        barcode: data.barcode,
      },
    });

  const screw = await material({ code: "PRF-M6-20", name: "Parafuso sextavado M6x20", description: "Aço zincado, rosca total", categoryId: fixacao.id, subcategoryId: parafusos.id, min: 100, max: 1000, point: 150, qty: 400, locationId: almox.id, supplierId: metalFix.id, supplierCode: "PX-M620", cost: 0.18, barcode: "7891000000011" });
  const nut = await material({ code: "POR-M6", name: "Porca sextavada M6", description: "Par de duas caixas", categoryId: fixacao.id, subcategoryId: porcas.id, min: 10, max: 200, point: 20, qty: 80, locationId: almox.id, supplierId: metalFix.id, supplierCode: "PN-M6", cost: 0.07, barcode: "7891000000028" });
  const washer = await material({ code: "ARR-M6", name: "Arruela lisa M6", description: "Arruela zincada", categoryId: fixacao.id, subcategoryId: porcas.id, min: 40, max: 300, point: 80, qty: 150, locationId: almox.id, supplierId: metalFix.id, cost: 0.04 });
  const bearing = await material({ code: "ROL-6203", name: "Rolamento 6203", description: "Rolamento rígido de esferas", categoryId: rolamentos.id, min: 2, max: 20, point: 4, qty: 6, locationId: almox.id, supplierId: rolamais.id, supplierCode: "6203-2RS", cost: 18.9 });
  const fuse = await material({ code: "FUS-10A", name: "Fusível 10A", description: "Fusível de vidro", categoryId: eletrica.id, subcategoryId: protecao.id, min: 10, max: 80, point: 20, qty: 30, locationId: oficina.id, supplierId: eletroSul.id, cost: 1.75 });
  const seal = await material({ code: "OR-210", name: "Anel de vedação OR-210", description: "Borracha nitrílica", categoryId: vedacao.id, min: 8, max: 60, point: 15, qty: 20, locationId: almox.id, supplierId: rolamais.id, cost: 2.4 });
  const belt = await material({ code: "COR-A42", name: "Correia A-42", description: "Correia em V", categoryId: rolamentos.id, min: 1, max: 8, point: 2, qty: 2, locationId: oficina.id, cost: 34 });
  const grease = await material({ code: "GRX-EP2", name: "Graxa EP2", description: "Cartucho de 400 g", categoryId: lubrificacao.id, unit: "UN", min: 4, max: 24, point: 6, qty: 12, locationId: oficina.id, cost: 16.5 });
  const filter = await material({ code: "FLT-AR", name: "Filtro de ar", description: "Elemento filtrante", categoryId: rolamentos.id, min: 5, max: 20, point: 6, qty: 8, locationId: almox.id, cost: 27 });
  const connector = await material({ code: "CON-E01", name: "Conector elétrico 3 vias", description: "Conector automotivo", categoryId: eletrica.id, min: 6, max: 40, point: 10, qty: 15, locationId: oficina.id, supplierId: eletroSul.id, cost: 4.2 });

  const enter = (materialId: string, locationId: string, quantity: number, containerId?: string) =>
    registerMovement({ materialId, type: "IN", quantity, toLocationId: locationId, toContainerId: containerId, userId: admin.id, note: "Carga inicial de demonstração" });
  const leave = (materialId: string, locationId: string, quantity: number, containerId?: string) =>
    registerMovement({ materialId, type: "OUT", quantity, fromLocationId: locationId, fromContainerId: containerId, userId: operator.id, note: "Consumo de demonstração" });

  await enter(screw.id, almox.id, 620);
  await leave(screw.id, almox.id, 80);
  await leave(screw.id, almox.id, 40);
  await enter(nut.id, almox.id, 80, working.id);
  await enter(nut.id, almox.id, 40, trigger.id);
  await leave(nut.id, almox.id, 40, trigger.id);
  await enter(washer.id, almox.id, 30);
  await enter(fuse.id, oficina.id, 12);
  await enter(seal.id, almox.id, 40);
  await enter(belt.id, oficina.id, 5);
  await leave(belt.id, oficina.id, 1);
  await enter(grease.id, oficina.id, 14);
  await leave(grease.id, oficina.id, 3);
  await enter(filter.id, almox.id, 2);
  await enter(connector.id, oficina.id, 22);
  await leave(connector.id, oficina.id, 4);

  await ensureAutoReplenishments();

  const actor = { id: operator.id, name: operator.name, email: operator.email, role: "OPERATOR" as const };
  const byCode = async (code: string) => {
    const item = await prisma.material.findUniqueOrThrow({ where: { code } });
    return prisma.replenishmentRequest.findFirstOrThrow({
      where: { materialId: item.id, status: { in: ["NEEDED", "REQUESTED", "IN_SUPPLY"] } },
    });
  };

  const washerRequest = await byCode("ARR-M6");
  await changeReplenishmentStatus(actor, washerRequest.id, "REQUESTED", "Pedido enviado ao fornecedor.");
  const bearingRequest = await byCode("ROL-6203");
  await changeReplenishmentStatus(actor, bearingRequest.id, "IN_SUPPLY", "Compra em transporte.");
  const filterRequest = await byCode("FLT-AR");
  await changeReplenishmentStatus(actor, filterRequest.id, "IN_SUPPLY");
  await changeReplenishmentStatus(actor, filterRequest.id, "REPLENISHED", "Conferido no fluxo. Aguardando a entrada física.");

  await createManualReplenishment(actor, {
    materialId: seal.id,
    locationId: almox.id,
    quantity: 20,
    priority: "MEDIUM",
    status: "REQUESTED",
    note: "Solicitação manual para a próxima manutenção.",
    assigneeId: operator.id,
  });

  await prisma.replenishmentRequest.create({
    data: {
      materialId: screw.id,
      locationId: almox.id,
      status: "REPLENISHED",
      priority: "LOW",
      quantity: 400,
      availableAtOpen: 80,
      source: "MANUAL",
      requestedById: admin.id,
      openedAt: daysAgo(12),
      closedAt: daysAgo(9),
      events: { create: { toStatus: "REPLENISHED", userId: admin.id, note: "Reposição anterior já recebida.", createdAt: daysAgo(9) } },
    },
  });

  const movements = await prisma.movement.findMany({ orderBy: { createdAt: "asc" } });
  for (const [index, movement] of movements.entries()) {
    await prisma.movement.update({ where: { id: movement.id }, data: { createdAt: daysAgo(index % 14) } });
  }

  await prisma.setting.createMany({
    data: [
      { key: "allowNegativeStock", value: "false" },
      { key: "companyName", value: "E-Kanban" },
      { key: "integrationEnabled", value: "false" },
      { key: "integrationApiKey", value: "" },
    ],
  });

  console.log("Base de demonstração pronta.");
  console.log("Admin: admin@ekanban.local / Admin@123");
  console.log("Operador: operador@ekanban.local / Operador@123");
  console.log("Visualizador: visualizador@ekanban.local / Visual@123");
  console.log(`Usuários criados: ${admin.email}, ${operator.email}, ${viewer.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

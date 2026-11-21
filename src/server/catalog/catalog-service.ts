import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { num } from "@/lib/numbers";
import { writeAudit } from "@/server/audit";
import type { SessionUser } from "@/server/auth/session";
import { saveSettings, type AppSettings } from "@/server/settings";
import type { z } from "zod";
import { categorySchema, containerSchema, locationSchema, supplierSchema, userSchema } from "@/server/validators";

type CategoryInput = z.infer<typeof categorySchema>;
type SupplierInput = z.infer<typeof supplierSchema>;
type LocationInput = z.infer<typeof locationSchema>;
type ContainerInput = z.infer<typeof containerSchema>;
type UserInput = z.infer<typeof userSchema>;

function appUrl() {
  return process.env.APP_URL || "http://localhost:3000";
}

export async function saveCategory(user: SessionUser, input: CategoryInput, id?: string) {
  const name = input.name.trim();
  const duplicated = await prisma.category.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      parentId: input.parentId,
      ...(id ? { NOT: { id } } : {}),
    },
  });
  if (duplicated) throw new AppError("Já existe uma categoria com este nome neste nível.", 409, "DUPLICATE");
  if (input.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: input.parentId } });
    if (!parent || parent.parentId) throw new AppError("A categoria pai é inválida.");
  }
  const data = { name, description: input.description, parentId: input.parentId, active: input.active };
  const category = id
    ? await prisma.category.update({ where: { id }, data })
    : await prisma.category.create({ data });
  await writeAudit(prisma, { userId: user.id, action: id ? "CATEGORY_UPDATE" : "CATEGORY_CREATE", entity: "Category", entityId: category.id });
  return category;
}

export async function saveSupplier(user: SessionUser, input: SupplierInput, id?: string) {
  const code = input.code.trim().toUpperCase();
  const duplicated = await prisma.supplier.findFirst({
    where: { code, ...(id ? { NOT: { id } } : {}) },
  });
  if (duplicated) throw new AppError("Já existe um fornecedor com este código.", 409, "DUPLICATE");
  const data = { name: input.name.trim(), code, email: input.email, phone: input.phone, active: input.active };
  const supplier = id
    ? await prisma.supplier.update({ where: { id }, data })
    : await prisma.supplier.create({ data });
  await writeAudit(prisma, { userId: user.id, action: id ? "SUPPLIER_UPDATE" : "SUPPLIER_CREATE", entity: "Supplier", entityId: supplier.id });
  return supplier;
}

export async function saveLocation(user: SessionUser, input: LocationInput, id?: string) {
  const code = input.code.trim().toUpperCase();
  const duplicated = await prisma.location.findFirst({ where: { code, ...(id ? { NOT: { id } } : {}) } });
  if (duplicated) throw new AppError("Já existe uma localização com este código.", 409, "DUPLICATE");
  if (id && !input.active) {
    const stock = await prisma.stockBalance.aggregate({ where: { locationId: id }, _sum: { onHand: true } });
    if (num(stock._sum.onHand) > 0) throw new AppError("A localização ainda possui saldo e não pode ser desativada.");
  }
  const data = { code, name: input.name.trim(), description: input.description, active: input.active };
  const location = id ? await prisma.location.update({ where: { id }, data }) : await prisma.location.create({ data });
  await writeAudit(prisma, { userId: user.id, action: id ? "LOCATION_UPDATE" : "LOCATION_CREATE", entity: "Location", entityId: location.id });
  return location;
}

export async function saveContainer(user: SessionUser, input: ContainerInput, id?: string) {
  const code = input.code.trim().toUpperCase();
  const duplicated = await prisma.container.findFirst({ where: { code, ...(id ? { NOT: { id } } : {}) } });
  if (duplicated) throw new AppError("Já existe um recipiente com este código.", 409, "DUPLICATE");
  const location = await prisma.location.findUnique({ where: { id: input.locationId } });
  if (!location || !location.active) throw new AppError("Localização inválida.");
  const current = id
    ? await prisma.container.findUnique({ where: { id }, include: { balances: true } })
    : null;
  if (id && !current) throw new AppError("Recipiente não encontrado.", 404);
  if (current) {
    const onHand = current.balances.reduce((sum, balance) => sum + num(balance.onHand), 0);
    if (current.locationId !== input.locationId && onHand > 0) {
      throw new AppError("Transfira o saldo antes de mudar o recipiente de localização.");
    }
    if (!input.active && onHand > 0) throw new AppError("O recipiente ainda possui saldo.");
  }
  const status = !input.active
    ? "INACTIVE"
    : current?.status === "IN_REPLENISHMENT"
      ? "IN_REPLENISHMENT"
      : "ACTIVE";
  const data = {
    code,
    type: input.type,
    description: input.description,
    locationId: input.locationId,
    capacity: input.capacity == null ? null : new Prisma.Decimal(input.capacity.toFixed(3)),
    pairGroup: input.pairGroup,
    binRole: input.binRole,
    active: input.active,
    status,
  } as const;
  const container = id
    ? await prisma.container.update({ where: { id }, data })
    : await prisma.container.create({ data });
  await writeAudit(prisma, { userId: user.id, action: id ? "CONTAINER_UPDATE" : "CONTAINER_CREATE", entity: "Container", entityId: container.id });
  return container;
}

export async function listContainers() {
  const containers = await prisma.container.findMany({
    include: { location: true, balances: { include: { material: true } } },
    orderBy: { code: "asc" },
  });
  return containers.map((container) => ({
    id: container.id,
    code: container.code,
    type: container.type,
    description: container.description,
    locationId: container.locationId,
    locationName: container.location.name,
    capacity: container.capacity == null ? null : num(container.capacity),
    status: container.status,
    pairGroup: container.pairGroup,
    binRole: container.binRole,
    active: container.active,
    publicToken: container.publicToken,
    qrUrl: `${appUrl()}/q/${container.publicToken}`,
    items: container.balances
      .filter((balance) => num(balance.onHand) !== 0 || num(balance.reserved) !== 0)
      .map((balance) => ({
        materialId: balance.materialId,
        code: balance.material.code,
        name: balance.material.name,
        onHand: num(balance.onHand),
        reserved: num(balance.reserved),
        unit: balance.material.unit,
      })),
  }));
}

export async function saveUser(actor: SessionUser, input: UserInput, id?: string) {
  const email = input.email.trim().toLowerCase();
  const duplicated = await prisma.user.findFirst({ where: { email, ...(id ? { NOT: { id } } : {}) } });
  if (duplicated) throw new AppError("Já existe um usuário com este e-mail.", 409, "DUPLICATE");
  if (!id && !input.password) throw new AppError("Informe uma senha inicial.");
  if (id) {
    const current = await prisma.user.findUnique({ where: { id } });
    if (!current) throw new AppError("Usuário não encontrado.", 404);
    const removesAdmin = current.role === "ADMIN" && current.active && (input.role !== "ADMIN" || !input.active);
    if (removesAdmin) {
      const others = await prisma.user.count({ where: { role: "ADMIN", active: true, NOT: { id } } });
      if (others === 0) throw new AppError("Deve permanecer ao menos um administrador ativo.");
    }
  }
  const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : undefined;
  const data = {
    name: input.name.trim(),
    email,
    role: input.role as Role,
    active: input.active,
    ...(passwordHash ? { passwordHash } : {}),
  };
  const user = id ? await prisma.user.update({ where: { id }, data }) : await prisma.user.create({ data: { ...data, passwordHash: passwordHash! } });
  await writeAudit(prisma, { userId: actor.id, action: id ? "USER_UPDATE" : "USER_CREATE", entity: "User", entityId: user.id });
  return { id: user.id };
}

export async function deleteUser(actor: SessionUser, id: string) {
  if (actor.id === id) throw new AppError("Você não pode excluir o próprio usuário.");
  const current = await prisma.user.findUnique({ where: { id } });
  if (!current) throw new AppError("Usuário não encontrado.", 404);
  if (current.role === "ADMIN" && current.active) {
    const others = await prisma.user.count({ where: { role: "ADMIN", active: true, NOT: { id } } });
    if (others === 0) throw new AppError("Deve permanecer ao menos um administrador ativo.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: { userId: id } });
    await tx.user.delete({ where: { id } });
  });
  await writeAudit(prisma, { userId: actor.id, action: "USER_DELETE", entity: "User", entityId: id, metadata: { email: current.email } });
}

export async function updateSettings(user: SessionUser, settings: AppSettings) {
  await saveSettings(prisma, settings);
  await writeAudit(prisma, {
    userId: user.id,
    action: "SETTINGS_UPDATE",
    entity: "Setting",
    metadata: {
      allowNegativeStock: settings.allowNegativeStock,
      integrationEnabled: settings.integrationEnabled,
      companyName: settings.companyName,
    },
  });
}

export async function qrDataUrl(token: string) {
  return QRCode.toDataURL(`${appUrl()}/q/${token}`, { margin: 1, width: 320 });
}

export async function resolveQr(token: string) {
  const material = await prisma.material.findUnique({
    where: { publicToken: token },
    include: {
      category: true,
      defaultLocation: true,
      balances: { include: { location: true, container: true } },
    },
  });
  if (material) {
    const onHand = material.balances.reduce((sum, balance) => sum + num(balance.onHand), 0);
    const reserved = material.balances.reduce((sum, balance) => sum + num(balance.reserved), 0);
    const available = onHand - reserved;
    const situation = available <= 0 ? "Sem estoque" : num(material.minStock) > 0 && available <= num(material.minStock) ? "Abaixo do mínimo" : "Adequado";
    return {
      kind: "material" as const,
      id: material.id,
      token: material.publicToken,
      code: material.code,
      name: material.name,
      description: material.description,
      unit: material.unit,
      imageUrl: material.imageUrl,
      category: material.category?.name ?? null,
      available,
      onHand,
      minStock: num(material.minStock),
      reorderPoint: num(material.reorderPoint),
      situation,
      active: material.active,
      locations: material.balances.map((balance) => ({
        locationId: balance.locationId,
        locationName: balance.location.name,
        containerId: balance.containerId,
        containerCode: balance.container?.code ?? null,
        available: num(balance.onHand) - num(balance.reserved),
      })),
      defaultLocationId: material.defaultLocationId,
    };
  }
  const container = await prisma.container.findUnique({
    where: { publicToken: token },
    include: { location: true, balances: { include: { material: true } } },
  });
  if (!container) throw new AppError("QR Code não reconhecido.", 404);
  return {
    kind: "container" as const,
    id: container.id,
    token: container.publicToken,
    code: container.code,
    type: container.type,
    description: container.description,
    locationId: container.locationId,
    locationName: container.location.name,
    status: container.status,
    binRole: container.binRole,
    pairGroup: container.pairGroup,
    items: container.balances.map((balance) => ({
      materialId: balance.materialId,
      code: balance.material.code,
      name: balance.material.name,
      unit: balance.material.unit,
      available: num(balance.onHand) - num(balance.reserved),
    })),
  };
}

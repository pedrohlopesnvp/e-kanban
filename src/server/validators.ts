import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

export const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});

export const materialSchema = z
  .object({
    code: z.string().trim().min(1, "Informe o código.").max(40),
    name: z.string().trim().min(2, "Informe o nome.").max(120),
    description: optionalText(2000),
    categoryId: optionalText(80),
    subcategoryId: optionalText(80),
    barcode: optionalText(80),
    imageUrl: optionalText(500),
    unit: z.string().trim().min(1).max(10).default("UN"),
    minStock: z.number().min(0).default(0),
    maxStock: z.number().min(0).default(0),
    reorderPoint: z.number().min(0).default(0),
    reorderQty: z.number().min(0).default(0),
    defaultLocationId: optionalText(80),
    supplierId: optionalText(80),
    supplierCode: optionalText(60),
    unitCost: z.number().min(0).default(0),
    active: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.maxStock > 0 && value.minStock > value.maxStock) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O estoque mínimo não pode ser maior que o máximo.",
        path: ["minStock"],
      });
    }
    if (value.maxStock > 0 && value.reorderPoint > value.maxStock) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O ponto de reposição não pode ser maior que o estoque máximo.",
        path: ["reorderPoint"],
      });
    }
    if (value.reorderPoint > 0 && !value.defaultLocationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe a localização padrão para acionar a reposição.",
        path: ["defaultLocationId"],
      });
    }
    if (value.subcategoryId && value.subcategoryId === value.categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A subcategoria deve ser diferente da categoria.",
        path: ["subcategoryId"],
      });
    }
  });

export const movementSchema = z.object({
  materialId: z.string().min(1),
  type: z.enum(["IN", "OUT", "ADJUSTMENT", "TRANSFER", "RESERVE", "RELEASE", "RETURN"]),
  quantity: z.number().positive("A quantidade deve ser maior que zero.").optional(),
  targetQuantity: z.number().min(0).optional(),
  fromLocationId: optionalText(80),
  toLocationId: optionalText(80),
  fromContainerId: optionalText(80),
  toContainerId: optionalText(80),
  note: optionalText(500),
  idempotencyKey: optionalText(80),
});

export const replenishmentSchema = z.object({
  materialId: z.string().min(1),
  locationId: z.string().min(1),
  quantity: z.number().positive("Informe a quantidade solicitada."),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  status: z.enum(["NEEDED", "REQUESTED", "IN_SUPPLY"]).default("REQUESTED"),
  note: optionalText(500),
  assigneeId: optionalText(80),
});

export const statusSchema = z.object({
  status: z.enum(["NEEDED", "REQUESTED", "IN_SUPPLY", "REPLENISHED", "CANCELLED"]),
  note: optionalText(500),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: optionalText(300),
  parentId: optionalText(80),
  active: z.boolean().default(true),
});

export const supplierSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(1).max(30),
  email: z
    .string()
    .trim()
    .email("E-mail inválido.")
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((value) => value || null),
  phone: optionalText(40),
  active: z.boolean().default(true),
});

export const locationSchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(2).max(120),
  description: optionalText(300),
  active: z.boolean().default(true),
});

export const containerSchema = z
  .object({
    code: z.string().trim().min(1).max(40),
    type: z.enum(["BOX", "DRAWER", "TRAY", "SHELF", "CUSTOM"]),
    description: optionalText(500),
    locationId: z.string().min(1, "Informe a localização."),
    capacity: z.number().positive().optional().nullable(),
    pairGroup: optionalText(40),
    binRole: z.enum(["NONE", "WORKING", "TRIGGER"]).default("NONE"),
    active: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.binRole !== "NONE" && !value.pairGroup) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o grupo do par para o Kanban de duas caixas.",
        path: ["pairGroup"],
      });
    }
  });

export const userSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email("E-mail inválido."),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres.").optional().or(z.literal("")),
  role: z.enum(["ADMIN", "OPERATOR", "VIEWER"]),
  active: z.boolean().default(true),
});

export const settingsSchema = z.object({
  allowNegativeStock: z.boolean(),
  companyName: z.string().trim().min(2).max(80),
  integrationEnabled: z.boolean(),
  integrationApiKey: z.string().trim().max(120).optional().nullable(),
});

export const kanbanMoveSchema = z.object({
  cardId: z.string().min(1),
  toColumn: z.enum(["AVAILABLE", "IN_USE", "CRITICAL", "EMPTY"]),
});

export function readPage(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get("page") || 1) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(searchParams.get("pageSize") || 20) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

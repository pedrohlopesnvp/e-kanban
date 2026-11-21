import { Prisma } from "@prisma/client";
import type { Prisma as PrismaTypes } from "@prisma/client";
import { prisma } from "@/lib/db";

type Db = PrismaTypes.TransactionClient | typeof prisma;

export async function writeAudit(
  db: Db,
  input: {
    userId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  await db.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      metadata: input.metadata,
    },
  });
}

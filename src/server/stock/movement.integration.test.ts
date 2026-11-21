import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { num } from "@/lib/numbers";
import { changeReplenishmentStatus } from "@/server/kanban/replenishment";
import { registerMovement } from "@/server/stock/movement-service";
import type { SessionUser } from "@/server/auth/session";

class Rollback extends Error {}

describe("movimentações persistidas", () => {
  it("atualiza saldo, bloqueia saída excedente, não duplica reposição e não entra estoque ao reabastecer", async () => {
    const stamp = Date.now();
    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { name: "Teste", email: `teste-${stamp}@ekanban.local`, passwordHash: "x", role: "ADMIN" },
        });
        const actor: SessionUser = { id: user.id, name: user.name, email: user.email, role: "ADMIN" };
        const location = await tx.location.create({ data: { code: `TST-${stamp}`, name: "Teste" } });
        const other = await tx.location.create({ data: { code: `DST-${stamp}`, name: "Destino" } });
        const material = await tx.material.create({
          data: {
            code: `MAT-${stamp}`,
            name: "Parafuso de teste",
            reorderPoint: 5,
            reorderQty: 20,
            minStock: 4,
            maxStock: 50,
            defaultLocationId: location.id,
          },
        });

        await registerMovement({ materialId: material.id, type: "IN", quantity: 10, toLocationId: location.id, userId: user.id }, tx);
        await expect(
          registerMovement({ materialId: material.id, type: "OUT", quantity: 11, fromLocationId: location.id, userId: user.id }, tx),
        ).rejects.toThrow(/disponível/i);

        await registerMovement({ materialId: material.id, type: "RESERVE", quantity: 4, fromLocationId: location.id, userId: user.id }, tx);
        await expect(
          registerMovement({ materialId: material.id, type: "OUT", quantity: 7, fromLocationId: location.id, userId: user.id }, tx),
        ).rejects.toThrow(/disponível/i);
        await registerMovement({ materialId: material.id, type: "OUT", quantity: 6, fromLocationId: location.id, userId: user.id }, tx);

        const reserved = await tx.stockBalance.findFirstOrThrow({ where: { materialId: material.id } });
        expect(num(reserved.onHand)).toBe(4);
        expect(num(reserved.reserved)).toBe(4);

        const open = await tx.replenishmentRequest.findMany({
          where: { materialId: material.id, status: { in: ["NEEDED", "REQUESTED", "IN_SUPPLY"] } },
        });
        expect(open).toHaveLength(1);

        await registerMovement({ materialId: material.id, type: "RELEASE", quantity: 4, fromLocationId: location.id, userId: user.id }, tx);
        const stillOne = await tx.replenishmentRequest.count({
          where: { materialId: material.id, status: { in: ["NEEDED", "REQUESTED", "IN_SUPPLY"] } },
        });
        expect(stillOne).toBe(1);

        const before = num((await tx.stockBalance.findFirstOrThrow({ where: { materialId: material.id } })).onHand);
        await changeReplenishmentStatus(actor, open[0].id, "IN_SUPPLY", null, tx);
        await changeReplenishmentStatus(actor, open[0].id, "REPLENISHED", null, tx);
        const after = num((await tx.stockBalance.findFirstOrThrow({ where: { materialId: material.id } })).onHand);
        expect(after).toBe(before);

        const key = `idem-${stamp}`;
        const first = await registerMovement(
          { materialId: material.id, type: "IN", quantity: 3, toLocationId: other.id, userId: user.id, idempotencyKey: key },
          tx,
        );
        const second = await registerMovement(
          { materialId: material.id, type: "IN", quantity: 3, toLocationId: other.id, userId: user.id, idempotencyKey: key },
          tx,
        );
        expect(second.replayed).toBe(true);
        expect(second.movementId).toBe(first.movementId);
        const destination = await tx.stockBalance.findFirstOrThrow({ where: { materialId: material.id, locationId: other.id } });
        expect(num(destination.onHand)).toBe(3);

        await registerMovement(
          {
            materialId: material.id,
            type: "TRANSFER",
            quantity: 2,
            fromLocationId: location.id,
            toLocationId: other.id,
            userId: user.id,
          },
          tx,
        );
        const origin = await tx.stockBalance.findFirstOrThrow({ where: { materialId: material.id, locationId: location.id } });
        const moved = await tx.stockBalance.findFirstOrThrow({ where: { materialId: material.id, locationId: other.id } });
        expect(num(origin.onHand)).toBe(before - 2);
        expect(num(moved.onHand)).toBe(5);

        throw new Rollback();
      }, { timeout: 20000 });
    } catch (error) {
      if (!(error instanceof Rollback)) throw error;
    }
  });

  it("encerra a solicitação quando o saldo volta para uso", async () => {
    const stamp = Date.now();
    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { name: "Uso", email: `uso-${stamp}@ekanban.local`, passwordHash: "x", role: "OPERATOR" },
        });
        const location = await tx.location.create({ data: { code: `USO-${stamp}`, name: "Uso" } });
        const material = await tx.material.create({
          data: {
            code: `USO-${stamp}`,
            name: "Material em uso",
            reorderPoint: 5,
            reorderQty: 20,
            minStock: 4,
            maxStock: 50,
            defaultLocationId: location.id,
          },
        });
        await registerMovement({ materialId: material.id, type: "IN", quantity: 4, toLocationId: location.id, userId: user.id }, tx);
        const open = await tx.replenishmentRequest.findFirst({
          where: { materialId: material.id, status: { in: ["NEEDED", "REQUESTED", "IN_SUPPLY"] } },
        });
        expect(open).not.toBeNull();
        await registerMovement({ materialId: material.id, type: "IN", quantity: 6, toLocationId: location.id, userId: user.id }, tx);
        const closed = await tx.replenishmentRequest.findFirstOrThrow({ where: { id: open!.id } });
        expect(closed.status).toBe("REPLENISHED");
        expect(num(closed.quantity)).toBe(0);
        const stillOpen = await tx.replenishmentRequest.count({
          where: { materialId: material.id, status: { in: ["NEEDED", "REQUESTED", "IN_SUPPLY"] } },
        });
        expect(stillOpen).toBe(0);
        throw new Rollback();
      }, { timeout: 20000 });
    } catch (error) {
      if (!(error instanceof Rollback)) throw error;
    }
  });

  it("exclui o usuário e mantém a movimentação sem o autor", async () => {
    const stamp = Date.now();
    try {
      await prisma.$transaction(async (tx) => {
        const person = await tx.user.create({
          data: { name: "Removido", email: `rm-${stamp}@ekanban.local`, passwordHash: "x", role: "OPERATOR" },
        });
        const location = await tx.location.create({ data: { code: `RM-${stamp}`, name: "Remoção" } });
        const material = await tx.material.create({
          data: { code: `RM-${stamp}`, name: "Material removível", defaultLocationId: location.id },
        });
        await registerMovement({ materialId: material.id, type: "IN", quantity: 1, toLocationId: location.id, userId: person.id }, tx);
        await tx.user.delete({ where: { id: person.id } });
        const movement = await tx.movement.findFirstOrThrow({ where: { materialId: material.id } });
        expect(movement.userId).toBeNull();
        const gone = await tx.user.findUnique({ where: { id: person.id } });
        expect(gone).toBeNull();
        throw new Rollback();
      }, { timeout: 20000 });
    } catch (error) {
      if (!(error instanceof Rollback)) throw error;
    }
  });

  it("permite saldo negativo apenas quando a configuração está ligada e dispara o par de caixas", async () => {
    const stamp = Date.now();
    try {
      await prisma.$transaction(async (tx) => {
        await tx.setting.upsert({
          where: { key: "allowNegativeStock" },
          create: { key: "allowNegativeStock", value: "true" },
          update: { value: "true" },
        });
        const user = await tx.user.create({
          data: { name: "Negativo", email: `neg-${stamp}@ekanban.local`, passwordHash: "x", role: "OPERATOR" },
        });
        const location = await tx.location.create({ data: { code: `NEG-${stamp}`, name: "Negativo" } });
        const trigger = await tx.container.create({
          data: { code: `CX-${stamp}`, type: "BOX", locationId: location.id, binRole: "TRIGGER", pairGroup: `PAR-${stamp}` },
        });
        const material = await tx.material.create({
          data: { code: `NEGMAT-${stamp}`, name: "Caixa de disparo", reorderPoint: 0, defaultLocationId: location.id },
        });
        await registerMovement({ materialId: material.id, type: "IN", quantity: 2, toLocationId: location.id, toContainerId: trigger.id, userId: user.id }, tx);
        await registerMovement({ materialId: material.id, type: "OUT", quantity: 5, fromLocationId: location.id, fromContainerId: trigger.id, userId: user.id }, tx);
        const balance = await tx.stockBalance.findFirstOrThrow({ where: { materialId: material.id } });
        expect(num(balance.onHand)).toBe(-3);
        const request = await tx.replenishmentRequest.findFirst({ where: { materialId: material.id, status: { in: ["NEEDED", "REQUESTED", "IN_SUPPLY"] } } });
        expect(request?.note).toMatch(/duas caixas/i);
        throw new Rollback();
      }, { timeout: 20000 });
    } catch (error) {
      if (!(error instanceof Rollback)) throw error;
    }
  });
});

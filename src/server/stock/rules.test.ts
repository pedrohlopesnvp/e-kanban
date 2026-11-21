import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import {
  assertAdjustment,
  assertCanLeaveStock,
  canTransition,
  computePriority,
  requestedQuantity,
  awaitingPhysicalReceipt,
  shouldAutoRequest,
  transitionChangesStock,
  kanbanStage,
  quantityForStage,
} from "@/server/stock/rules";

describe("regras de estoque", () => {
  it("impede saída maior que o disponível", () => {
    expect(() =>
      assertCanLeaveStock({
        onHand: 10,
        reserved: 4,
        quantity: 7,
        allowNegative: false,
        purpose: "out",
      }),
    ).toThrow(AppError);
  });

  it("permite saída até o disponível, descontando a reserva", () => {
    expect(() =>
      assertCanLeaveStock({
        onHand: 10,
        reserved: 4,
        quantity: 6,
        allowNegative: false,
        purpose: "out",
      }),
    ).not.toThrow();
  });

  it("permite estoque negativo somente com a configuração ligada", () => {
    expect(() =>
      assertCanLeaveStock({
        onHand: 2,
        reserved: 0,
        quantity: 5,
        allowNegative: true,
        purpose: "out",
      }),
    ).not.toThrow();
  });

  it("não deixa reservar acima do disponível, mesmo com estoque negativo habilitado", () => {
    expect(() =>
      assertCanLeaveStock({
        onHand: 5,
        reserved: 1,
        quantity: 5,
        allowNegative: true,
        purpose: "reserve",
      }),
    ).toThrow(/reserva/i);
  });

  it("calcula o delta do ajuste e protege a quantidade reservada", () => {
    expect(assertAdjustment({ onHand: 10, reserved: 2, target: 7, allowNegative: false })).toEqual({
      target: 7,
      delta: -3,
    });
    expect(() =>
      assertAdjustment({ onHand: 10, reserved: 4, target: 3, allowNegative: false }),
    ).toThrow(/reservada/i);
  });

  it("não abre outra automática enquanto o recebimento físico não foi lançado", () => {
    expect(
      awaitingPhysicalReceipt({ latestStatus: "REPLENISHED", availableQty: 2, reorderPoint: 6 }),
    ).toBe(true);
    expect(
      awaitingPhysicalReceipt({ latestStatus: "REPLENISHED", availableQty: 8, reorderPoint: 6 }),
    ).toBe(false);
    expect(
      awaitingPhysicalReceipt({ latestStatus: "NEEDED", availableQty: 2, reorderPoint: 6 }),
    ).toBe(false);
  });

  it("abre reposição automática uma única vez ao atingir o ponto", () => {
    expect(
      shouldAutoRequest({ active: true, reorderPoint: 10, availableQty: 10, hasActiveRequest: false }),
    ).toBe(true);
    expect(
      shouldAutoRequest({ active: true, reorderPoint: 10, availableQty: 10, hasActiveRequest: true }),
    ).toBe(false);
    expect(
      shouldAutoRequest({ active: true, reorderPoint: 0, availableQty: 0, hasActiveRequest: false }),
    ).toBe(false);
    expect(
      shouldAutoRequest({ active: false, reorderPoint: 5, availableQty: 0, hasActiveRequest: false }),
    ).toBe(false);
  });

  it("define prioridade e quantidade sugerida", () => {
    expect(computePriority(0, 5)).toBe("CRITICAL");
    expect(computePriority(3, 5)).toBe("HIGH");
    expect(computePriority(8, 5)).toBe("MEDIUM");
    expect(requestedQuantity(40, 100, 10)).toBe(40);
    expect(requestedQuantity(0, 100, 10)).toBe(90);
  });

  it("classifica o cartão pelas quatro etapas do saldo", () => {
    expect(kanbanStage({ availableQty: 1000, maxStock: 1000, reorderPoint: 150, minStock: 100 })).toBe("AVAILABLE");
    expect(kanbanStage({ availableQty: 500, maxStock: 1000, reorderPoint: 150, minStock: 100 })).toBe("IN_USE");
    expect(kanbanStage({ availableQty: 150, maxStock: 1000, reorderPoint: 150, minStock: 100 })).toBe("CRITICAL");
    expect(kanbanStage({ availableQty: 30, maxStock: 300, reorderPoint: 80, minStock: 40 })).toBe("CRITICAL");
    expect(kanbanStage({ availableQty: 0, maxStock: 20, reorderPoint: 4, minStock: 2 })).toBe("EMPTY");
    expect(kanbanStage({ availableQty: 8, maxStock: 0, reorderPoint: 0, minStock: 0 })).toBe("AVAILABLE");
  });

  it("sugere uma quantidade que cai na área escolhida", () => {
    const limits = { maxStock: 1000, reorderPoint: 150, minStock: 100 };
    for (const stage of ["EMPTY", "CRITICAL", "IN_USE", "AVAILABLE"] as const) {
      const quantity = quantityForStage(stage, limits);
      expect(quantity).not.toBeNull();
      expect(kanbanStage({ availableQty: quantity!, ...limits })).toBe(stage);
    }
  });

  it("não trata a coluna reabastecido como entrada de estoque", () => {
    expect(canTransition("IN_SUPPLY", "REPLENISHED")).toBe(true);
    expect(canTransition("REPLENISHED", "IN_SUPPLY")).toBe(false);
    expect(canTransition("AVAILABLE", "REPLENISHED")).toBe(false);
    expect(transitionChangesStock()).toBe(false);
  });
});

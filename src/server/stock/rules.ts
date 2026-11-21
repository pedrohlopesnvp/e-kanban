import { AppError } from "@/lib/errors";
import { roundQty } from "@/lib/numbers";

export { kanbanStage, quantityForStage, KANBAN_STAGES, type KanbanStage } from "@/lib/kanban-stage";

export const ACTIVE_REPLENISHMENT_STATUSES = ["NEEDED", "REQUESTED", "IN_SUPPLY"] as const;

export type StockPurpose = "out" | "reserve" | "adjust";

export function availableOf(onHand: number, reserved: number) {
  return roundQty(onHand - reserved);
}

export function assertQuantity(quantity: number) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new AppError("A quantidade deve ser maior que zero.");
  }
}

export function assertCanLeaveStock(input: {
  onHand: number;
  reserved: number;
  quantity: number;
  allowNegative: boolean;
  purpose: Exclude<StockPurpose, "adjust">;
}) {
  assertQuantity(input.quantity);
  const available = availableOf(input.onHand, input.reserved);
  if (input.purpose === "reserve") {
    if (input.quantity > available + 1e-9) {
      throw new AppError("A reserva é maior que o saldo disponível.");
    }
    return;
  }
  if (!input.allowNegative && input.quantity > available + 1e-9) {
    throw new AppError("A saída é maior que o saldo disponível.");
  }
}

export function assertAdjustment(input: {
  onHand: number;
  reserved: number;
  target: number;
  allowNegative: boolean;
}) {
  if (!Number.isFinite(input.target)) {
    throw new AppError("Informe a quantidade contada.");
  }
  const target = roundQty(input.target);
  if (!input.allowNegative && target < -1e-9) {
    throw new AppError("O ajuste deixaria o estoque negativo.");
  }
  if (!input.allowNegative && target + 1e-9 < input.reserved) {
    throw new AppError("O ajuste deixaria o saldo menor que a quantidade reservada.");
  }
  const delta = roundQty(target - input.onHand);
  if (Math.abs(delta) < 0.0005) {
    throw new AppError("A quantidade informada é igual ao saldo atual.");
  }
  return { target, delta };
}

export function computePriority(availableQty: number, minStock: number) {
  if (availableQty <= 0) return "CRITICAL" as const;
  if (minStock > 0 && availableQty <= minStock) return "HIGH" as const;
  return "MEDIUM" as const;
}

export function awaitingPhysicalReceipt(input: {
  latestStatus: string | null;
  availableQty: number;
  reorderPoint: number;
}) {
  return (
    input.latestStatus === "REPLENISHED" &&
    input.reorderPoint > 0 &&
    input.availableQty <= input.reorderPoint + 1e-9
  );
}

export function shouldAutoRequest(input: {
  active: boolean;
  reorderPoint: number;
  availableQty: number;
  hasActiveRequest: boolean;
}) {
  if (!input.active) return false;
  if (input.reorderPoint <= 0) return false;
  if (input.hasActiveRequest) return false;
  return input.availableQty <= input.reorderPoint + 1e-9;
}

export function requestedQuantity(reorderQty: number, maxStock: number, availableQty: number) {
  if (reorderQty > 0) return roundQty(reorderQty);
  if (maxStock > availableQty) return roundQty(maxStock - availableQty);
  return 1;
}

const transitions: Record<string, string[]> = {
  NEEDED: ["REQUESTED", "IN_SUPPLY", "CANCELLED"],
  REQUESTED: ["IN_SUPPLY", "NEEDED", "CANCELLED"],
  IN_SUPPLY: ["REPLENISHED", "REQUESTED", "CANCELLED"],
  REPLENISHED: [],
  CANCELLED: [],
};

export function canTransition(from: string, to: string) {
  return transitions[from]?.includes(to) ?? false;
}

/** Mudar a etapa do Kanban nunca altera o saldo físico. */
export function transitionChangesStock() {
  return false;
}

export function isCritical(availableQty: number, minStock: number) {
  return availableQty <= 0 || (minStock > 0 && availableQty <= minStock);
}

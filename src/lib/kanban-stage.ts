import { roundQty } from "@/lib/numbers";

export const KANBAN_STAGES = ["AVAILABLE", "IN_USE", "CRITICAL", "EMPTY"] as const;
export type KanbanStage = (typeof KANBAN_STAGES)[number];

/** A etapa do quadro acompanha o saldo. */
export function kanbanStage(input: {
  availableQty: number;
  maxStock: number;
  reorderPoint: number;
  minStock: number;
}): KanbanStage {
  if (input.availableQty <= 1e-9) return "EMPTY";
  const replenishAt = input.reorderPoint > 0 ? input.reorderPoint : input.minStock;
  if (replenishAt > 0 && input.availableQty <= replenishAt + 1e-9) return "CRITICAL";
  if (input.maxStock > 0 && input.availableQty + 1e-9 < input.maxStock) return "IN_USE";
  return "AVAILABLE";
}

/** Quantidade que coloca o material na área pedida. Nulo quando os limites não permitem essa área. */
export function quantityForStage(
  stage: KanbanStage,
  input: { maxStock: number; reorderPoint: number; minStock: number },
) {
  const replenishAt = input.reorderPoint > 0 ? input.reorderPoint : input.minStock;
  if (stage === "EMPTY") return 0;
  if (stage === "CRITICAL") return replenishAt > 0 ? replenishAt : null;
  if (stage === "AVAILABLE") {
    if (input.maxStock > 0) return input.maxStock;
    return roundQty(replenishAt > 0 ? replenishAt + 1 : 1);
  }
  if (input.maxStock > replenishAt) {
    const mid = roundQty(replenishAt + (input.maxStock - replenishAt) / 2);
    if (mid > replenishAt && mid < input.maxStock) return mid;
  }
  return null;
}

export function roundQty(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function num(value: unknown) {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return roundQty(parsed);
}

export function formatQty(value: number, unit?: string) {
  const text = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(value);
  return unit ? `${text} ${unit}` : text;
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

import Link from "next/link";
import { DashboardCharts } from "@/components/dashboard/charts";
import { movementLabels } from "@/lib/labels";
import { formatDateTime, formatMoney, formatQty } from "@/lib/numbers";
import { withSearch } from "@/lib/search";
import { getDashboard } from "@/server/dashboard/dashboard-service";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const params = await searchParams;
  const days = Number(params.days || 30);
  const data = await getDashboard(days);
  const cards = [
    ["Materiais cadastrados", String(data.totals.materials), "blue"],
    ["Com estoque adequado", String(data.totals.adequate), "green"],
    ["Abaixo do mínimo", String(data.totals.belowMin), "yellow"],
    ["Sem estoque", String(data.totals.outOfStock), "red"],
    ["Reposições abertas", String(data.totals.openRequests), "orange"],
    ["Reposições concluídas", String(data.totals.doneRequests), "violet"],
    ["Valor do estoque", formatMoney(data.totals.stockValue), "blue"],
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Painel</h1>
          <p className="text-sm text-muted-foreground">Indicadores calculados a partir do estoque e das movimentações.</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((option) => (
            <Link
              key={option}
              href={withSearch("/painel", {}, { days: String(option) })}
              className={`rounded-lg px-3 py-2 text-sm ${days === option ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            >
              {option} dias
            </Link>
          ))}
        </div>
      </div>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, tone]) => (
          <article key={label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`mt-2 text-2xl font-semibold ${tone === "red" ? "text-danger" : tone === "yellow" ? "text-warning" : tone === "green" ? "text-success" : ""}`}>
              {value}
            </p>
          </article>
        ))}
      </section>
      <DashboardCharts
        categories={data.categories}
        situations={data.situations}
        flow={data.flow}
        requests={data.requests}
        consumption={data.consumption}
      />
      <section className="rounded-xl border border-border bg-card">
        <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">Movimentações recentes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Quando</th>
                <th className="px-4 py-3 font-medium">Material</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Qtd.</th>
                <th className="px-4 py-3 font-medium">Responsável</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((movement) => (
                <tr key={movement.id} className="border-t border-border">
                  <td className="px-4 py-3">{formatDateTime(movement.createdAt)}</td>
                  <td className="px-4 py-3">
                    {movement.code} · {movement.name}
                  </td>
                  <td className="px-4 py-3">{movementLabels[movement.type]}</td>
                  <td className="px-4 py-3">{formatQty(movement.quantity, movement.unit)}</td>
                  <td className="px-4 py-3">{movement.userName}</td>
                </tr>
              ))}
              {data.recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Ainda não há movimentações.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

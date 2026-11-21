import Link from "next/link";
import { FilterBar, FilterField, FilterMenu } from "@/components/ui/filters";
import { movementLabels } from "@/lib/labels";
import { formatDateTime, formatQty } from "@/lib/numbers";
import { withSearch } from "@/lib/search";
import { listMovements } from "@/server/stock/movement-service";
import type { MovementType } from "@prisma/client";

const types = ["IN", "OUT", "ADJUSTMENT", "TRANSFER", "RESERVE", "RELEASE", "RETURN"];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || 1));
  const type = params.type && types.includes(params.type) ? (params.type as MovementType) : undefined;
  const data = await listMovements({
    type,
    from: params.from ? new Date(params.from) : undefined,
    to: params.to ? new Date(`${params.to}T23:59:59`) : undefined,
    page,
    pageSize: 30,
  });
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const current = { from: params.from, to: params.to, type: params.type };
  const exportParams = new URLSearchParams();
  if (params.from) exportParams.set("from", params.from);
  if (params.to) exportParams.set("to", params.to);
  if (params.type) exportParams.set("type", params.type);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Movimentações rastreáveis por período, usuário e tipo.</p>
        </div>
        <a href={`/api/movements/export?${exportParams.toString()}`} className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm">Exportar CSV</a>
      </div>
      <FilterBar action="/relatorios" clearHref="/relatorios" columns="xl:grid-cols-[repeat(2,minmax(11rem,0.8fr))_minmax(12rem,1fr)_auto]">
        <FilterField label="De" type="date" name="from" defaultValue={params.from || ""} />
        <FilterField label="Até" type="date" name="to" defaultValue={params.to || ""} />
        <FilterMenu
          name="type"
          label="Tipo"
          value={params.type || ""}
          options={[
            { value: "", label: "Todos os tipos" },
            ...types.map((item) => ({ value: item, label: movementLabels[item as MovementType] })),
          ]}
        />
      </FilterBar>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Data</th><th className="px-4 py-3">Material</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Quantidade</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3">Destino</th><th className="px-4 py-3">Usuário</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="px-4 py-3">{formatDateTime(item.createdAt)}</td>
                <td className="px-4 py-3">{item.code}</td>
                <td className="px-4 py-3">{movementLabels[item.type]}</td>
                <td className="px-4 py-3">{formatQty(item.quantity, item.unit)}</td>
                <td className="px-4 py-3">{item.fromLocation || "—"}</td>
                <td className="px-4 py-3">{item.toLocation || "—"}</td>
                <td className="px-4 py-3">{item.userName}</td>
              </tr>
            ))}
            {data.items.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhuma movimentação no período.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2 text-sm">
        {page > 1 ? <Link className="rounded-lg border border-border px-3 py-2" href={withSearch("/relatorios", current, { page: String(page - 1) })}>Anterior</Link> : null}
        {page < pages ? <Link className="rounded-lg border border-border px-3 py-2" href={withSearch("/relatorios", current, { page: String(page + 1) })}>Próxima</Link> : null}
      </div>
    </div>
  );
}

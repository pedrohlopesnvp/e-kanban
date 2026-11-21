import Link from "next/link";
import { prisma } from "@/lib/db";
import { MovementDialog } from "@/components/stock/movement-form";
import { FilterBar, FilterField, FilterMenu } from "@/components/ui/filters";
import { movementLabels } from "@/lib/labels";
import { formatDateTime, formatQty } from "@/lib/numbers";
import { withSearch } from "@/lib/search";
import { canMoveStock, requirePageUser } from "@/server/auth/permissions";
import { listBalances, listMovements } from "@/server/stock/movement-service";
import type { MovementType } from "@prisma/client";

const types = ["IN", "OUT", "ADJUSTMENT", "TRANSFER", "RESERVE", "RELEASE", "RETURN"];

export default async function StockPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || 1));
  const type = params.type && types.includes(params.type) ? (params.type as MovementType) : undefined;
  const [balances, movements, materials, locations, containers] = await Promise.all([
    listBalances({ q: params.q, locationId: params.locationId, page, pageSize: 20 }),
    listMovements({
      type,
      materialId: params.materialId,
      from: params.from ? new Date(params.from) : undefined,
      to: params.to ? new Date(`${params.to}T23:59:59`) : undefined,
      page: 1,
      pageSize: 15,
    }),
    prisma.material.findMany({ where: { active: true }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    prisma.location.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    prisma.container.findMany({ where: { active: true }, select: { id: true, code: true, locationId: true }, orderBy: { code: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(balances.total / balances.pageSize));
  const current = { q: params.q, locationId: params.locationId };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Estoque</h1>
          <p className="text-sm text-muted-foreground">Entradas, saídas, ajustes, transferências, reservas e devoluções.</p>
        </div>
        {canMoveStock(user.role) ? <MovementDialog materials={materials} locations={locations} containers={containers} /> : null}
      </div>
      <FilterBar action="/estoque" clearHref="/estoque" columns="xl:grid-cols-[minmax(14rem,1.4fr)_minmax(12rem,1fr)_auto]">
        <FilterField label="Material" name="q" defaultValue={params.q || ""} placeholder="Código ou nome" />
        <FilterMenu
          name="locationId"
          label="Localização"
          value={params.locationId || ""}
          options={[{ value: "", label: "Todas as localizações" }, ...locations.map((location) => ({ value: location.id, label: location.name }))]}
        />
      </FilterBar>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr><th className="px-4 py-3">Material</th><th className="px-4 py-3">Local</th><th className="px-4 py-3">Recipiente</th><th className="px-4 py-3">Físico</th><th className="px-4 py-3">Reservado</th><th className="px-4 py-3">Disponível</th></tr>
          </thead>
          <tbody>
            {balances.items.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="px-4 py-3"><Link href={`/materiais/${item.materialId}`}>{item.code} · {item.name}</Link></td>
                <td className="px-4 py-3">{item.locationName}</td>
                <td className="px-4 py-3">{item.containerCode || "—"}</td>
                <td className="px-4 py-3">{formatQty(item.onHand, item.unit)}</td>
                <td className="px-4 py-3">{formatQty(item.reserved, item.unit)}</td>
                <td className="px-4 py-3">{formatQty(item.available, item.unit)}</td>
              </tr>
            ))}
            {balances.items.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum saldo encontrado.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2 text-sm">
        {page > 1 ? <Link className="rounded-lg border border-border px-3 py-2" href={withSearch("/estoque", current, { page: String(page - 1) })}>Anterior</Link> : null}
        {page < pages ? <Link className="rounded-lg border border-border px-3 py-2" href={withSearch("/estoque", current, { page: String(page + 1) })}>Próxima</Link> : null}
      </div>
      <section className="rounded-xl border border-border bg-card">
        <h2 className="border-b border-border px-4 py-3 font-semibold">Últimas movimentações</h2>
        <ul className="divide-y divide-border">
          {movements.items.map((movement) => (
            <li key={movement.id} className="grid gap-1 px-4 py-3 text-sm md:grid-cols-4">
              <span>{formatDateTime(movement.createdAt)}</span>
              <span>{movement.code} · {movementLabels[movement.type]}</span>
              <span>{formatQty(movement.quantity, movement.unit)}</span>
              <span className="text-muted-foreground">{movement.userName}{movement.note ? ` · ${movement.note}` : ""}</span>
            </li>
          ))}
          {movements.items.length === 0 ? <li className="px-4 py-6 text-sm text-muted-foreground">Sem movimentações.</li> : null}
        </ul>
      </section>
    </div>
  );
}

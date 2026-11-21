import Link from "next/link";
import { prisma } from "@/lib/db";
import { ImportMaterials } from "@/components/materials/import-materials";
import { Badge } from "@/components/ui/badge";
import { FilterBar, FilterField, FilterMenu } from "@/components/ui/filters";
import { formatMoney, formatQty } from "@/lib/numbers";
import { withSearch } from "@/lib/search";
import { canWriteMasterData, requirePageUser } from "@/server/auth/permissions";
import { listMaterials } from "@/server/materials/material-service";

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || 1));
  const [data, categories] = await Promise.all([
    listMaterials({
      q: params.q,
      categoryId: params.categoryId,
      availability: params.availability,
      active: params.active || "true",
      sort: params.sort,
      dir: params.dir,
      page,
      pageSize: 20,
    }),
    prisma.category.findMany({ where: { parentId: null }, orderBy: { name: "asc" } }),
  ]);
  const current = {
    q: params.q,
    categoryId: params.categoryId,
    availability: params.availability,
    active: params.active,
    sort: params.sort,
    dir: params.dir,
  };
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Materiais</h1>
          <p className="text-sm text-muted-foreground">{data.total} registros. O saldo vem das movimentações.</p>
        </div>
        {canWriteMasterData(user.role) ? (
          <div className="flex flex-wrap gap-2">
            <a href="/api/materials/export" className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm">Exportar CSV</a>
            <ImportMaterials />
            <Link href="/materiais/novo" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm text-primary-foreground">Novo material</Link>
          </div>
        ) : (
          <a href="/api/materials/export" className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm">Exportar CSV</a>
        )}
      </div>
      <FilterBar action="/materiais" clearHref="/materiais" columns="xl:grid-cols-[minmax(14rem,1.4fr)_repeat(3,minmax(11rem,1fr))_auto]">
        <FilterField label="Material" name="q" defaultValue={params.q || ""} placeholder="Código, nome ou barras" />
        <FilterMenu
          name="categoryId"
          label="Categoria"
          value={params.categoryId || ""}
          options={[{ value: "", label: "Todas as categorias" }, ...categories.map((category) => ({ value: category.id, label: category.name }))]}
        />
        <FilterMenu
          name="availability"
          label="Disponibilidade"
          value={params.availability || ""}
          options={[
            { value: "", label: "Toda a disponibilidade" },
            { value: "OK", label: "Adequado" },
            { value: "LOW", label: "Abaixo do mínimo" },
            { value: "OUT", label: "Sem estoque" },
            { value: "REORDER", label: "No ponto de reposição" },
          ]}
        />
        <FilterMenu
          name="active"
          label="Situação"
          value={params.active || "true"}
          options={[
            { value: "true", label: "Ativos" },
            { value: "false", label: "Inativos" },
            { value: "all", label: "Todos" },
          ]}
        />
      </FilterBar>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3"><Link href={withSearch("/materiais", current, { sort: "code", dir: params.dir === "asc" ? "desc" : "asc" })}>Código</Link></th>
              <th className="px-4 py-3"><Link href={withSearch("/materiais", current, { sort: "name", dir: params.dir === "asc" ? "desc" : "asc" })}>Material</Link></th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3"><Link href={withSearch("/materiais", current, { sort: "available", dir: "asc" })}>Disponível</Link></th>
              <th className="px-4 py-3">Mínimo</th>
              <th className="px-4 py-3">Custo</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => {
              const critical = item.available <= 0 || (item.minStock > 0 && item.available <= item.minStock);
              return (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium"><Link href={`/materiais/${item.id}`}>{item.code}</Link></td>
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3">{item.categoryName || "—"}</td>
                  <td className={`px-4 py-3 ${critical ? "text-danger" : ""}`}>{formatQty(item.available, item.unit)}</td>
                  <td className="px-4 py-3">{formatQty(item.minStock, item.unit)}</td>
                  <td className="px-4 py-3">{formatMoney(item.unitCost)}</td>
                  <td className="px-4 py-3"><Badge tone={item.active ? "green" : "muted"}>{item.active ? "Ativo" : "Inativo"}</Badge></td>
                </tr>
              );
            })}
            {data.items.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Nenhum material encontrado.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span>Página {page} de {pages}</span>
        <div className="flex gap-2">
          {page > 1 ? <Link className="rounded-lg border border-border px-3 py-2" href={withSearch("/materiais", current, { page: String(page - 1) })}>Anterior</Link> : null}
          {page < pages ? <Link className="rounded-lg border border-border px-3 py-2" href={withSearch("/materiais", current, { page: String(page + 1) })}>Próxima</Link> : null}
        </div>
      </div>
    </div>
  );
}

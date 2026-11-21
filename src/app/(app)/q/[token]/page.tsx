import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { MovementForm } from "@/components/stock/movement-form";
import { Badge } from "@/components/ui/badge";
import { binRoleLabels, containerTypeLabels } from "@/lib/labels";
import { formatQty } from "@/lib/numbers";
import { canMoveStock, canOperateKanban, requirePageUser } from "@/server/auth/permissions";
import { resolveQr } from "@/server/catalog/catalog-service";
import { ReplenishmentButton } from "@/components/qr/replenishment-button";

export default async function QrPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const record = await resolveQr(token);
    const user = await requirePageUser();
    const [materials, locations, containers] = await Promise.all([
      prisma.material.findMany({ where: { active: true }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
      prisma.location.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
      prisma.container.findMany({ where: { active: true }, select: { id: true, code: true, locationId: true } }),
    ]);
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        {record.kind === "material" ? (
          <>
            <div>
              <p className="text-sm text-muted-foreground">{record.code}</p>
              <h1 className="text-2xl font-semibold">{record.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{record.description || "Sem descrição"}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Info label="Disponível" value={formatQty(record.available, record.unit)} />
              <Info label="Mínimo" value={formatQty(record.minStock, record.unit)} />
              <Info label="Situação" value={record.situation} />
            </div>
            <Badge tone={record.situation === "Sem estoque" ? "red" : record.situation === "Abaixo do mínimo" ? "yellow" : "green"}>{record.situation}</Badge>
            <ul className="space-y-2 text-sm">
              {record.locations.map((location) => (
                <li key={`${location.locationId}-${location.containerId}`} className="rounded-lg border border-border px-3 py-2">
                  {location.locationName}{location.containerCode ? ` · ${location.containerCode}` : ""} · {formatQty(location.available, record.unit)}
                </li>
              ))}
              {record.locations.length === 0 ? <li className="text-muted-foreground">Sem saldo lançado.</li> : null}
            </ul>
            {canMoveStock(user.role) ? (
              <section className="rounded-xl border border-border bg-card p-4">
                <h2 className="mb-3 font-semibold">Movimentar</h2>
                <MovementForm materials={materials} locations={locations} containers={containers} preset={{ materialId: record.id, locationId: record.defaultLocationId || undefined }} />
              </section>
            ) : null}
            {canOperateKanban(user.role) && record.defaultLocationId ? (
              <ReplenishmentButton materialId={record.id} locationId={record.defaultLocationId} />
            ) : null}
          </>
        ) : (
          <>
            <div>
              <p className="text-sm text-muted-foreground">{containerTypeLabels[record.type]}</p>
              <h1 className="text-2xl font-semibold">{record.code}</h1>
              <p className="text-sm text-muted-foreground">{record.locationName} · {binRoleLabels[record.binRole]}</p>
              {record.description ? <p className="mt-2 text-sm">{record.description}</p> : null}
            </div>
            <ul className="space-y-2">
              {record.items.map((item) => (
                <li key={item.materialId} className="rounded-lg border border-border px-3 py-2 text-sm">{item.code} · {item.name} · {formatQty(item.available, item.unit)}</li>
              ))}
              {record.items.length === 0 ? <li className="text-sm text-muted-foreground">Nenhum material neste recipiente.</li> : null}
            </ul>
          </>
        )}
      </div>
    );
  } catch {
    notFound();
  }
}

function Info({ label, value }: { label: string; value: string }) {
  return <article className="rounded-xl border border-border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></article>;
}

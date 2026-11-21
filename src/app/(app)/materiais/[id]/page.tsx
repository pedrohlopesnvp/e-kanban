import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { MaterialForm } from "@/components/materials/material-form";
import { Badge } from "@/components/ui/badge";
import { movementLabels, priorityLabels, statusLabels } from "@/lib/labels";
import { formatDateTime, formatMoney, formatQty } from "@/lib/numbers";
import { canWriteMasterData, requirePageUser } from "@/server/auth/permissions";
import { getMaterial, materialQr } from "@/server/materials/material-service";

export default async function MaterialDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  try {
    const [material, qr, categories, locations, suppliers] = await Promise.all([
      getMaterial(id),
      materialQr(id),
      prisma.category.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    ]);
    const canEdit = canWriteMasterData(user.role);
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{material.code}</p>
            <h1 className="text-2xl font-semibold">{material.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{material.description || "Sem descrição"}</p>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
            <img src={qr.dataUrl} alt={`QR Code de ${material.code}`} className="h-28 w-28 rounded-lg bg-white p-1" />
            <div className="text-sm">
              <p className="font-medium">Identificação</p>
              <p className="text-muted-foreground">O QR Code aponta para um identificador interno.</p>
              <Link href={`/q/${material.publicToken}`} className="text-primary">Abrir ficha</Link>
            </div>
          </div>
        </div>
        <section className="grid gap-3 sm:grid-cols-4">
          <Info label="Disponível" value={formatQty(material.available, material.unit)} />
          <Info label="Físico" value={formatQty(material.onHand, material.unit)} />
          <Info label="Reservado" value={formatQty(material.reserved, material.unit)} />
          <Info label="Custo unitário" value={formatMoney(material.unitCost)} />
        </section>
        <section className="rounded-xl border border-border bg-card">
          <h2 className="border-b border-border px-4 py-3 font-semibold">Saldos por localização</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground"><tr><th className="px-4 py-3">Local</th><th className="px-4 py-3">Recipiente</th><th className="px-4 py-3">Físico</th><th className="px-4 py-3">Reservado</th><th className="px-4 py-3">Disponível</th></tr></thead>
              <tbody>
                {material.balances.map((balance) => (
                  <tr key={balance.id} className="border-t border-border">
                    <td className="px-4 py-3">{balance.locationCode} · {balance.locationName}</td>
                    <td className="px-4 py-3">{balance.containerCode || "—"}</td>
                    <td className="px-4 py-3">{formatQty(balance.onHand, material.unit)}</td>
                    <td className="px-4 py-3">{formatQty(balance.reserved, material.unit)}</td>
                    <td className="px-4 py-3">{formatQty(balance.available, material.unit)}</td>
                  </tr>
                ))}
                {material.balances.length === 0 ? <tr><td colSpan={5} className="px-4 py-6 text-muted-foreground">Nenhuma movimentação ainda.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-border bg-card">
            <h2 className="border-b border-border px-4 py-3 font-semibold">Histórico de movimentações</h2>
            <ul className="divide-y divide-border">
              {material.movements.map((movement) => (
                <li key={movement.id} className="px-4 py-3 text-sm">
                  <p className="font-medium">{movementLabels[movement.type]} · {formatQty(movement.quantity, material.unit)}</p>
                  <p className="text-muted-foreground">{formatDateTime(movement.createdAt)} · {movement.userName}</p>
                  {movement.note ? <p>{movement.note}</p> : null}
                </li>
              ))}
              {material.movements.length === 0 ? <li className="px-4 py-6 text-sm text-muted-foreground">Sem movimentações.</li> : null}
            </ul>
          </article>
          <article className="rounded-xl border border-border bg-card">
            <h2 className="border-b border-border px-4 py-3 font-semibold">Reposições</h2>
            <ul className="divide-y divide-border">
              {material.requests.map((request) => (
                <li key={request.id} className="space-y-2 px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge tone={request.status === "REPLENISHED" ? "green" : request.status === "NEEDED" ? "yellow" : "blue"}>{statusLabels[request.status]}</Badge>
                    <span>{priorityLabels[request.priority]}</span>
                  </div>
                  <p>{request.locationName} · {formatQty(request.quantity, material.unit)}</p>
                  <p className="text-muted-foreground">{formatDateTime(request.openedAt)}</p>
                </li>
              ))}
              {material.requests.length === 0 ? <li className="px-4 py-6 text-sm text-muted-foreground">Sem solicitações.</li> : null}
            </ul>
          </article>
        </section>
        {canEdit ? (
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-semibold">Editar cadastro</h2>
            <MaterialForm
              id={material.id}
              categories={categories}
              locations={locations}
              suppliers={suppliers}
              initial={{
                code: material.code,
                name: material.name,
                description: material.description || "",
                categoryId: material.categoryId || "",
                subcategoryId: material.subcategoryId || "",
                barcode: material.barcode || "",
                imageUrl: material.imageUrl || "",
                unit: material.unit,
                minStock: material.minStock,
                maxStock: material.maxStock,
                reorderPoint: material.reorderPoint,
                reorderQty: material.reorderQty,
                defaultLocationId: material.defaultLocationId || "",
                supplierId: material.supplierId || "",
                supplierCode: material.supplierCode || "",
                unitCost: material.unitCost,
                active: material.active,
              }}
            />
          </section>
        ) : null}
      </div>
    );
  } catch {
    notFound();
  }
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </article>
  );
}

import { prisma } from "@/lib/db";
import { SupplierEditor } from "@/components/catalog/editors";
import { canWriteMasterData, requirePageUser } from "@/server/auth/permissions";

export default async function SuppliersPage() {
  const user = await requirePageUser();
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Fornecedores</h1>
      {canWriteMasterData(user.role) ? <SupplierEditor suppliers={suppliers} /> : (
        <ul className="space-y-2">{suppliers.map((supplier) => <li key={supplier.id} className="rounded-xl border border-border bg-card px-4 py-3">{supplier.code} · {supplier.name}</li>)}</ul>
      )}
    </div>
  );
}

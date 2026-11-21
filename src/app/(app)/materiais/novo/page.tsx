import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { MaterialForm } from "@/components/materials/material-form";
import { canWriteMasterData, requirePageUser } from "@/server/auth/permissions";

export default async function NewMaterialPage() {
  const user = await requirePageUser();
  if (!canWriteMasterData(user.role)) redirect("/materiais");
  const [categories, locations, suppliers] = await Promise.all([
    prisma.category.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Novo material</h1>
        <p className="text-sm text-muted-foreground">O código é único. A quantidade atual será gerada pelas movimentações.</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <MaterialForm categories={categories} locations={locations} suppliers={suppliers} />
      </div>
    </div>
  );
}

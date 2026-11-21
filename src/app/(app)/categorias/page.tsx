import { prisma } from "@/lib/db";
import { CategoryEditor } from "@/components/catalog/editors";
import { canWriteMasterData, requirePageUser } from "@/server/auth/permissions";

export default async function CategoriesPage() {
  const user = await requirePageUser();
  const categories = await prisma.category.findMany({ orderBy: [{ parentId: "asc" }, { name: "asc" }] });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Categorias</h1>
      {canWriteMasterData(user.role) ? <CategoryEditor categories={categories} /> : <p className="text-sm text-muted-foreground">Consulta disponível para o seu perfil.</p>}
      {!canWriteMasterData(user.role) ? (
        <ul className="space-y-2">{categories.map((category) => <li key={category.id} className="rounded-xl border border-border bg-card px-4 py-3">{category.name}</li>)}</ul>
      ) : null}
    </div>
  );
}

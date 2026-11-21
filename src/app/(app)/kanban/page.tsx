import { prisma } from "@/lib/db";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { KanbanFilters } from "@/components/kanban/kanban-filters";
import { requirePageUser } from "@/server/auth/permissions";
import { getKanbanBoard } from "@/server/kanban/replenishment";
import type { Priority } from "@prisma/client";

export default async function KanbanPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoryId?: string; locationId?: string; priority?: string }>;
}) {
  await requirePageUser();
  const params = await searchParams;
  const priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const [cards, categories, locations] = await Promise.all([
    getKanbanBoard({
      q: params.q,
      categoryId: params.categoryId,
      locationId: params.locationId,
      priority: params.priority && priorities.includes(params.priority) ? (params.priority as Priority) : undefined,
    }),
    prisma.category.findMany({ where: { active: true, parentId: null }, orderBy: { name: "asc" } }),
    prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">E-Kanban</h1>
        <p className="text-sm text-muted-foreground">
          A etapa acompanha o saldo: completo em Disponível, consumo em Em uso, ponto de reposição em Crítico e falta em Vazio.
        </p>
      </div>
      <KanbanFilters
        q={params.q}
        categoryId={params.categoryId}
        locationId={params.locationId}
        priority={params.priority}
        categories={categories}
        locations={locations}
      />
      <KanbanBoard cards={cards} />
    </div>
  );
}

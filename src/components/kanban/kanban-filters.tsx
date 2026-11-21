"use client";

import { FilterBar, FilterField, FilterMenu } from "@/components/ui/filters";

export function KanbanFilters({
  q,
  categoryId,
  locationId,
  priority,
  categories,
  locations,
}: {
  q?: string;
  categoryId?: string;
  locationId?: string;
  priority?: string;
  categories: { id: string; name: string }[];
  locations: { id: string; name: string }[];
}) {
  return (
    <FilterBar action="/kanban" clearHref="/kanban" columns="xl:grid-cols-[minmax(14rem,1.4fr)_repeat(3,minmax(11rem,1fr))_auto]">
      <FilterField label="Material" name="q" defaultValue={q || ""} placeholder="Código ou nome" />
      <FilterMenu
        name="categoryId"
        label="Categoria"
        value={categoryId || ""}
        options={[{ value: "", label: "Todas as categorias" }, ...categories.map((category) => ({ value: category.id, label: category.name }))]}
      />
      <FilterMenu
        name="locationId"
        label="Localização"
        value={locationId || ""}
        options={[{ value: "", label: "Todas as localizações" }, ...locations.map((location) => ({ value: location.id, label: location.name }))]}
      />
      <FilterMenu
        name="priority"
        label="Prioridade"
        value={priority || ""}
        options={[
          { value: "", label: "Todas as prioridades" },
          { value: "LOW", label: "Baixa" },
          { value: "MEDIUM", label: "Média" },
          { value: "HIGH", label: "Alta" },
          { value: "CRITICAL", label: "Crítica" },
        ]}
      />
    </FilterBar>
  );
}

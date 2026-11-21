"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterMenu } from "@/components/ui/filters";
import { mutate } from "@/lib/client";
import { kanbanColumns, type KanbanColumnId } from "@/lib/labels";
import { formatMoney, formatQty } from "@/lib/numbers";
import { kanbanStage, quantityForStage } from "@/lib/kanban-stage";

const stageTone: Record<KanbanColumnId, "blue" | "green" | "yellow" | "red"> = {
  AVAILABLE: "blue",
  IN_USE: "green",
  CRITICAL: "yellow",
  EMPTY: "red",
};

const stageBorder: Record<KanbanColumnId, string> = {
  AVAILABLE: "border-blue-500!",
  IN_USE: "border-emerald-500!",
  CRITICAL: "border-yellow-400!",
  EMPTY: "border-red-500!",
};

const stageFill: Record<KanbanColumnId, string> = {
  AVAILABLE: "bg-blue-500/15",
  IN_USE: "bg-emerald-500/15",
  CRITICAL: "bg-yellow-400/15",
  EMPTY: "bg-red-500/15",
};

export type ScannedMaterial = {
  kind: "material";
  id: string;
  code: string;
  name: string;
  description: string | null;
  barcode: string | null;
  imageUrl: string | null;
  unit: string;
  category: string | null;
  subcategory: string | null;
  supplier: string | null;
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  reorderQty: number;
  unitCost: number;
  active: boolean;
  defaultLocationId: string | null;
  defaultLocationName: string | null;
  available: number;
  onHand: number;
  reserved: number;
  stage: KanbanColumnId;
  locations: { id: string; name: string }[];
  balances: {
    locationId: string;
    locationName: string;
    containerId: string | null;
    containerCode: string | null;
    onHand: number;
    reserved: number;
    available: number;
  }[];
};

export type ScannedContainer = {
  kind: "container";
  id: string;
  code: string;
  description: string | null;
  locationName: string;
  type: string;
  binRole: string;
  items: { materialId: string; code: string; name: string; unit: string; available: number }[];
};

function locationAvailable(material: ScannedMaterial, locationId: string) {
  return material.balances.filter((balance) => balance.locationId === locationId).reduce((sum, balance) => sum + balance.available, 0);
}

export function MaterialScanResult({
  material,
  canEdit,
  onUpdated,
}: {
  material: ScannedMaterial;
  canEdit: boolean;
  onUpdated: (material: ScannedMaterial) => void;
}) {
  const initialLocation = material.defaultLocationId || material.balances[0]?.locationId || material.locations[0]?.id || "";
  const [locationId, setLocationId] = useState(initialLocation);
  const [units, setUnits] = useState(String(locationAvailable(material, initialLocation)));
  const [pending, setPending] = useState(false);
  const limits = useMemo(
    () => ({ maxStock: material.maxStock, reorderPoint: material.reorderPoint, minStock: material.minStock }),
    [material.maxStock, material.reorderPoint, material.minStock],
  );
  const quantity = Number(units);
  const stage = Number.isFinite(quantity) ? kanbanStage({ availableQty: quantity, ...limits }) : material.stage;

  function selectLocation(nextLocationId: string) {
    setLocationId(nextLocationId);
    setUnits(String(locationAvailable(material, nextLocationId)));
  }

  function selectStage(next: KanbanColumnId) {
    const suggested = quantityForStage(next, limits);
    if (suggested == null) {
      toast.error("Os limites deste material não permitem essa área.");
      return;
    }
    setUnits(String(suggested));
  }

  async function save() {
    if (!locationId) {
      toast.error("Escolha a localização.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      toast.error("Informe uma quantidade válida.");
      return;
    }
    const rows = material.balances.filter((balance) => balance.locationId === locationId);
    const primary = rows.find((balance) => !balance.containerId) ?? rows[0];
    const currentAvailable = rows.reduce((sum, balance) => sum + balance.available, 0);
    const delta = quantity - currentAvailable;
    if (Math.abs(delta) < 0.0005) {
      toast.success("A quantidade já está nessa área.");
      return;
    }
    const targetOnHand = (primary?.onHand ?? 0) + delta;
    setPending(true);
    try {
      await mutate("/api/movements", {
        method: "POST",
        body: JSON.stringify({
          materialId: material.id,
          type: "ADJUSTMENT",
          targetQuantity: targetOnHand,
          toLocationId: locationId,
          toContainerId: primary?.containerId ?? null,
          note: "Ajuste pela leitura de código.",
        }),
      });
      const updated = await mutate<ScannedMaterial>(`/api/scan?code=${encodeURIComponent(material.code)}`);
      onUpdated(updated);
      setUnits(String(locationAvailable(updated, locationId)));
      toast.success("Quantidade e área atualizadas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-xs font-semibold">
          {material.imageUrl ? <img src={material.imageUrl} alt="" className="h-full w-full object-cover" /> : material.code.slice(0, 3)}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{material.code}</p>
          <h2 className="text-lg font-semibold">{material.name}</h2>
          <p className="text-sm text-muted-foreground">{material.description || "Sem descrição"}</p>
        </div>
        <Badge tone={stageTone[stage]}>{kanbanColumns.find((column) => column.id === stage)?.title}</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Info label="Categoria" value={material.category || "—"} />
        <Info label="Subcategoria" value={material.subcategory || "—"} />
        <Info label="Código de barras" value={material.barcode || "—"} />
        <Info label="Fornecedor" value={material.supplier || "—"} />
        <Info label="Disponível" value={formatQty(material.available, material.unit)} />
        <Info label="Físico" value={formatQty(material.onHand, material.unit)} />
        <Info label="Reservado" value={formatQty(material.reserved, material.unit)} />
        <Info label="Custo" value={formatMoney(material.unitCost)} />
        <Info label="Mínimo" value={formatQty(material.minStock, material.unit)} />
        <Info label="Máximo" value={formatQty(material.maxStock, material.unit)} />
        <Info label="Ponto de reposição" value={formatQty(material.reorderPoint, material.unit)} />
        <Info label="Local padrão" value={material.defaultLocationName || "—"} />
      </dl>
      {material.balances.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {material.balances.map((balance) => (
            <li key={`${balance.locationId}-${balance.containerId}`} className="text-muted-foreground">
              {balance.locationName}
              {balance.containerCode ? ` · ${balance.containerCode}` : ""} · {formatQty(balance.available, material.unit)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Sem saldo lançado.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <FilterMenu
          name="locationId"
          label="Localização"
          value={locationId}
          disabled={!canEdit}
          onChange={selectLocation}
          options={material.locations.map((location) => ({ value: location.id, label: location.name }))}
        />
        <label className="text-sm">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Unidades</span>
          <input
            type="number"
            min="0"
            step="0.001"
            value={units}
            disabled={!canEdit}
            onChange={(event) => setUnits(event.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-background px-3"
          />
        </label>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Área no Kanban</p>
        <div className="grid grid-cols-2 gap-2">
          {kanbanColumns.map((column) => (
            <button
              key={column.id}
              type="button"
              disabled={!canEdit}
              onClick={() => selectStage(column.id)}
              className={`rounded-lg border-2 px-3 py-2 text-left text-sm ${stageBorder[column.id]} ${stage === column.id ? stageFill[column.id] : ""}`}
            >
              <span className="font-medium">{column.title}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{column.hint}</span>
            </button>
          ))}
        </div>
      </div>
      {canEdit ? (
        <div className="flex justify-end">
          <Button onClick={() => void save()} disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Seu perfil consulta o material sem alterar unidades ou área.</p>
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

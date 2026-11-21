"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { mutate } from "@/lib/client";
import { movementLabels } from "@/lib/labels";

type MaterialOption = { id: string; code: string; name: string };
type LocationOption = { id: string; code: string; name: string };
type ContainerOption = { id: string; code: string; locationId: string };

export function MovementDialog({
  materials,
  locations,
  containers,
  preset,
}: {
  materials: MaterialOption[];
  locations: LocationOption[];
  containers: ContainerOption[];
  preset?: { materialId?: string; locationId?: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Nova movimentação</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar movimentação</DialogTitle>
          </DialogHeader>
          <MovementForm
            materials={materials}
            locations={locations}
            containers={containers}
            preset={preset}
            onDone={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function MovementForm({
  materials,
  locations,
  containers,
  preset,
  onDone,
}: {
  materials: MaterialOption[];
  locations: LocationOption[];
  containers: ContainerOption[];
  preset?: { materialId?: string; locationId?: string };
  onDone?: () => void;
}) {
  const router = useRouter();
  const idempotency = useRef(crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [type, setType] = useState("IN");
  const [origin, setOrigin] = useState(preset?.locationId || "");
  const [destination, setDestination] = useState(preset?.locationId || "");
  const needsOrigin = ["OUT", "RESERVE", "RELEASE", "TRANSFER", "ADJUSTMENT"].includes(type);
  const needsDestination = ["IN", "RETURN", "TRANSFER"].includes(type);
  const adjustment = type === "ADJUSTMENT";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      materialId: String(form.get("materialId")),
      type,
      quantity: adjustment ? undefined : Number(form.get("quantity")),
      targetQuantity: adjustment ? Number(form.get("targetQuantity")) : undefined,
      fromLocationId: needsOrigin ? String(form.get("fromLocationId") || "") || null : null,
      toLocationId: needsDestination ? String(form.get("toLocationId") || "") || null : adjustment ? String(form.get("fromLocationId") || "") || null : null,
      fromContainerId: needsOrigin ? String(form.get("fromContainerId") || "") || null : null,
      toContainerId: needsDestination ? String(form.get("toContainerId") || "") || null : adjustment ? String(form.get("fromContainerId") || "") || null : null,
      note: String(form.get("note") || "") || null,
    };
    setPending(true);
    try {
      await mutate("/api/movements", {
        method: "POST",
        headers: { "Idempotency-Key": idempotency.current },
        body: JSON.stringify(payload),
      });
      toast.success("Movimentação registrada. O saldo foi atualizado.");
      idempotency.current = crypto.randomUUID();
      onDone?.();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na movimentação.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form method="post" onSubmit={onSubmit} className="grid gap-3">
      <Field label="Material">
        <Select name="materialId" required defaultValue={preset?.materialId || ""}>
          <option value="" disabled>Selecione</option>
          {materials.map((material) => (
            <option key={material.id} value={material.id}>{material.code} · {material.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Operação">
        <Select value={type} onChange={(event) => setType(event.target.value)}>
          {Object.entries(movementLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </Field>
      {needsOrigin ? (
        <>
          <Field label={adjustment ? "Localização contada" : "Origem"}>
            <Select name="fromLocationId" required value={origin} onChange={(event) => setOrigin(event.target.value)}>
              <option value="">Selecione</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.code} · {location.name}</option>)}
            </Select>
          </Field>
          <Field label="Recipiente de origem">
            <Select name="fromContainerId" defaultValue="">
              <option value="">Sem recipiente</option>
              {containers.filter((container) => container.locationId === origin).map((container) => (
                <option key={container.id} value={container.id}>{container.code}</option>
              ))}
            </Select>
          </Field>
        </>
      ) : null}
      {needsDestination ? (
        <>
          <Field label="Destino">
            <Select name="toLocationId" required value={destination} onChange={(event) => setDestination(event.target.value)}>
              <option value="">Selecione</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.code} · {location.name}</option>)}
            </Select>
          </Field>
          <Field label="Recipiente de destino">
            <Select name="toContainerId" defaultValue="">
              <option value="">Sem recipiente</option>
              {containers.filter((container) => container.locationId === destination).map((container) => (
                <option key={container.id} value={container.id}>{container.code}</option>
              ))}
            </Select>
          </Field>
        </>
      ) : null}
      {adjustment ? (
        <Field label="Quantidade contada">
          <Input name="targetQuantity" type="number" min="0" step="0.001" required />
        </Field>
      ) : (
        <Field label="Quantidade">
          <Input name="quantity" type="number" min="0.001" step="0.001" required />
        </Field>
      )}
      <Field label="Observação">
        <Textarea name="note" placeholder="Justificativa, documento ou responsável externo" />
      </Field>
      <Button disabled={pending}>{pending ? "Registrando..." : "Confirmar"}</Button>
    </form>
  );
}

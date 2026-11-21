"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { mutate } from "@/lib/client";

export type MaterialFormValues = {
  code: string;
  name: string;
  description: string;
  categoryId: string;
  subcategoryId: string;
  barcode: string;
  imageUrl: string;
  unit: string;
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  reorderQty: number;
  defaultLocationId: string;
  supplierId: string;
  supplierCode: string;
  unitCost: number;
  active: boolean;
};

type Option = { id: string; name: string; parentId?: string | null };

export function MaterialForm({
  id,
  initial,
  categories,
  locations,
  suppliers,
}: {
  id?: string;
  initial?: Partial<MaterialFormValues>;
  categories: Option[];
  locations: Option[];
  suppliers: Option[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [categoryId, setCategoryId] = useState(initial?.categoryId || "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || "");
  const values = { unit: "UN", active: true, minStock: 0, maxStock: 0, reorderPoint: 0, reorderQty: 0, unitCost: 0, ...initial };

  async function upload(file: File) {
    const body = new FormData();
    body.set("file", file);
    const result = await mutate<{ url: string }>("/api/upload", { method: "POST", body });
    setImageUrl(result.url);
    toast.success("Imagem enviada.");
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      code: String(form.get("code") || ""),
      name: String(form.get("name") || ""),
      description: String(form.get("description") || "") || null,
      categoryId: String(form.get("categoryId") || "") || null,
      subcategoryId: String(form.get("subcategoryId") || "") || null,
      barcode: String(form.get("barcode") || "") || null,
      imageUrl: imageUrl || null,
      unit: String(form.get("unit") || "UN"),
      minStock: Number(form.get("minStock") || 0),
      maxStock: Number(form.get("maxStock") || 0),
      reorderPoint: Number(form.get("reorderPoint") || 0),
      reorderQty: Number(form.get("reorderQty") || 0),
      defaultLocationId: String(form.get("defaultLocationId") || "") || null,
      supplierId: String(form.get("supplierId") || "") || null,
      supplierCode: String(form.get("supplierCode") || "") || null,
      unitCost: Number(form.get("unitCost") || 0),
      active: form.get("active") === "on",
    };
    setPending(true);
    try {
      const result = await mutate<{ id: string }>(id ? `/api/materials/${id}` : "/api/materials", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      toast.success(id ? "Material atualizado." : "Material cadastrado.");
      router.push(`/materiais/${result.id || id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setPending(false);
    }
  }

  const subcategories = categories.filter((category) => category.parentId === categoryId);

  return (
    <form method="post" onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
      <Field label="Código">
        <Input name="code" defaultValue={values.code} required />
      </Field>
      <Field label="Nome">
        <Input name="name" defaultValue={values.name} required />
      </Field>
      <div className="md:col-span-2">
        <Field label="Descrição">
          <Textarea name="description" defaultValue={values.description} />
        </Field>
      </div>
      <Field label="Categoria">
        <Select name="categoryId" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">Sem categoria</option>
          {categories.filter((category) => !category.parentId).map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Subcategoria">
        <Select name="subcategoryId" defaultValue={values.subcategoryId || ""}>
          <option value="">Sem subcategoria</option>
          {subcategories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Código de barras">
        <Input name="barcode" defaultValue={values.barcode} />
      </Field>
      <Field label="Unidade">
        <Input name="unit" defaultValue={values.unit} required />
      </Field>
      <Field label="Estoque mínimo">
        <Input name="minStock" type="number" min="0" step="0.001" defaultValue={values.minStock} />
      </Field>
      <Field label="Estoque máximo">
        <Input name="maxStock" type="number" min="0" step="0.001" defaultValue={values.maxStock} />
      </Field>
      <Field label="Ponto de reposição" hint="Ao atingir este saldo, uma solicitação é aberta se não houver outra ativa.">
        <Input name="reorderPoint" type="number" min="0" step="0.001" defaultValue={values.reorderPoint} />
      </Field>
      <Field label="Quantidade padrão de reposição">
        <Input name="reorderQty" type="number" min="0" step="0.001" defaultValue={values.reorderQty} />
      </Field>
      <Field label="Localização padrão">
        <Select name="defaultLocationId" defaultValue={values.defaultLocationId || ""}>
          <option value="">Selecione</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>{location.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Fornecedor principal">
        <Select name="supplierId" defaultValue={values.supplierId || ""}>
          <option value="">Sem fornecedor</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Código do fornecedor">
        <Input name="supplierCode" defaultValue={values.supplierCode} />
      </Field>
      <Field label="Custo unitário">
        <Input name="unitCost" type="number" min="0" step="0.0001" defaultValue={values.unitCost} />
      </Field>
      <div className="md:col-span-2">
        <Field label="Imagem">
          <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])} />
        </Field>
        {imageUrl ? <img src={imageUrl} alt="" className="mt-3 h-24 w-24 rounded-lg object-cover" /> : null}
      </div>
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input name="active" type="checkbox" defaultChecked={values.active} className="h-4 w-4" />
        Material ativo
      </label>
      <div className="md:col-span-2">
        <Button disabled={pending}>{pending ? "Salvando..." : "Salvar material"}</Button>
      </div>
    </form>
  );
}

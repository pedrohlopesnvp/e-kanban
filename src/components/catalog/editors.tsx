"use client";

import { useRouter } from "next/navigation";
import { Children, isValidElement, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FilterMenu } from "@/components/ui/filters";
import { mutate } from "@/lib/client";
import { binRoleLabels, containerStatusLabels, containerTypeLabels, roleLabels } from "@/lib/labels";

async function save(url: string, method: string, payload: unknown) {
  await mutate(url, { method, body: JSON.stringify(payload) });
}

function useRefresh() {
  const router = useRouter();
  return () => router.refresh();
}

export function CategoryEditor({
  categories,
}: {
  categories: { id: string; name: string; description: string | null; parentId: string | null; active: boolean }[];
}) {
  const refresh = useRefresh();
  const [editing, setEditing] = useState<string | null>(null);
  const current = categories.find((item) => item.id === editing);
  return (
    <Editor
      title={current ? "Editar categoria" : "Nova categoria"}
      onSubmit={async (form) => {
        const payload = {
          name: String(form.get("name") || ""),
          description: String(form.get("description") || "") || null,
          parentId: String(form.get("parentId") || "") || null,
          active: form.get("active") === "on",
        };
        await save(editing ? `/api/categories/${editing}` : "/api/categories", editing ? "PATCH" : "POST", payload);
        setEditing(null);
        refresh();
      }}
    >
      <Field label="Nome"><Input name="name" key={current?.id || "new"} defaultValue={current?.name} required /></Field>
      <Field label="Descrição"><Input name="description" key={`${current?.id}-d`} defaultValue={current?.description || ""} /></Field>
      <Field label="Categoria pai">
        <Select name="parentId" key={`${current?.id}-p`} defaultValue={current?.parentId || ""}>
          <option value="">Categoria principal</option>
          {categories.filter((item) => !item.parentId && item.id !== current?.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
      </Field>
      <Active checked={current?.active ?? true} />
      <Rows rows={categories.map((item) => ({ id: item.id, title: item.name, meta: item.parentId ? "Subcategoria" : "Categoria", active: item.active }))} onEdit={setEditing} />
    </Editor>
  );
}

export function SupplierEditor({ suppliers }: { suppliers: { id: string; name: string; code: string; email: string | null; phone: string | null; active: boolean }[] }) {
  const refresh = useRefresh();
  const [editing, setEditing] = useState<string | null>(null);
  const current = suppliers.find((item) => item.id === editing);
  return (
    <Editor title={current ? "Editar fornecedor" : "Novo fornecedor"} onSubmit={async (form) => {
      await save(editing ? `/api/suppliers/${editing}` : "/api/suppliers", editing ? "PATCH" : "POST", {
        name: form.get("name"), code: form.get("code"), email: String(form.get("email") || "") || null, phone: String(form.get("phone") || "") || null, active: form.get("active") === "on",
      });
      setEditing(null); refresh();
    }}>
      <Field label="Nome"><Input name="name" key={current?.id} defaultValue={current?.name} required /></Field>
      <Field label="Código"><Input name="code" key={`${current?.id}-c`} defaultValue={current?.code} required /></Field>
      <Field label="E-mail"><Input name="email" type="email" key={`${current?.id}-e`} defaultValue={current?.email || ""} /></Field>
      <Field label="Telefone"><Input name="phone" key={`${current?.id}-p`} defaultValue={current?.phone || ""} /></Field>
      <Active checked={current?.active ?? true} />
      <Rows rows={suppliers.map((item) => ({ id: item.id, title: `${item.code} · ${item.name}`, meta: item.email || "Sem e-mail", active: item.active }))} onEdit={setEditing} />
    </Editor>
  );
}

export function LocationEditor({ locations }: { locations: { id: string; code: string; name: string; description: string | null; active: boolean }[] }) {
  const refresh = useRefresh();
  const [editing, setEditing] = useState<string | null>(null);
  const current = locations.find((item) => item.id === editing);
  return (
    <Editor title={current ? "Editar localização" : "Nova localização"} onSubmit={async (form) => {
      await save(editing ? `/api/locations/${editing}` : "/api/locations", editing ? "PATCH" : "POST", {
        code: form.get("code"), name: form.get("name"), description: String(form.get("description") || "") || null, active: form.get("active") === "on",
      });
      setEditing(null); refresh();
    }}>
      <Field label="Código"><Input name="code" key={current?.id} defaultValue={current?.code} required /></Field>
      <Field label="Nome"><Input name="name" key={`${current?.id}-n`} defaultValue={current?.name} required /></Field>
      <Field label="Descrição"><Input name="description" key={`${current?.id}-d`} defaultValue={current?.description || ""} /></Field>
      <Active checked={current?.active ?? true} />
      <Rows rows={locations.map((item) => ({ id: item.id, title: `${item.code} · ${item.name}`, meta: item.description || "", active: item.active }))} onEdit={setEditing} />
    </Editor>
  );
}

export function ContainerEditor({
  containers,
  locations,
  canWrite,
}: {
  containers: {
    id: string; code: string; type: string; description: string | null; locationId: string; locationName: string;
    capacity: number | null; status: string; pairGroup: string | null; binRole: string; active: boolean; qrUrl: string;
    items: { code: string; name: string; onHand: number; unit: string }[];
  }[];
  locations: { id: string; name: string }[];
  canWrite: boolean;
}) {
  const refresh = useRefresh();
  const [editing, setEditing] = useState<string | null>(null);
  const current = containers.find((item) => item.id === editing);
  return (
    <div className="space-y-4">
      {canWrite ? (
        <Editor title={current ? "Editar recipiente" : "Novo recipiente"} onSubmit={async (form) => {
          await save(editing ? `/api/containers/${editing}` : "/api/containers", editing ? "PATCH" : "POST", {
            code: form.get("code"),
            type: form.get("type"),
            description: String(form.get("description") || "") || null,
            locationId: form.get("locationId"),
            capacity: form.get("capacity") ? Number(form.get("capacity")) : null,
            pairGroup: String(form.get("pairGroup") || "") || null,
            binRole: form.get("binRole"),
            active: form.get("active") === "on",
          });
          setEditing(null); refresh();
        }}>
          <Field label="Código"><Input name="code" key={current?.id} defaultValue={current?.code} required /></Field>
          <Field label="Tipo">
            <Select name="type" key={`${current?.id}-t`} defaultValue={current?.type || "BOX"}>
              {Object.entries(containerTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Localização">
            <Select name="locationId" key={`${current?.id}-l`} defaultValue={current?.locationId || ""} required>
              <option value="">Selecione</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </Select>
          </Field>
          <Field label="Capacidade"><Input name="capacity" type="number" min="0" step="0.001" key={`${current?.id}-cap`} defaultValue={current?.capacity ?? ""} /></Field>
          <Field label="Grupo do par" hint="Use o mesmo grupo em duas caixas para o Kanban de duas caixas.">
            <Input name="pairGroup" key={`${current?.id}-g`} defaultValue={current?.pairGroup || ""} />
          </Field>
          <Field label="Papel no par">
            <Select name="binRole" key={`${current?.id}-b`} defaultValue={current?.binRole || "NONE"}>
              {Object.entries(binRoleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Descrição"><Textarea name="description" key={`${current?.id}-d`} defaultValue={current?.description || ""} /></Field>
          <Active checked={current?.active ?? true} />
        </Editor>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {containers.map((container) => (
          <article key={container.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{container.code}</h3>
                <p className="text-sm text-muted-foreground">{containerTypeLabels[container.type as keyof typeof containerTypeLabels]} · {container.locationName}</p>
                <p className="text-sm">{containerStatusLabels[container.status as keyof typeof containerStatusLabels]} · {binRoleLabels[container.binRole as keyof typeof binRoleLabels]}</p>
                {container.pairGroup ? <p className="text-xs text-muted-foreground">Par {container.pairGroup}</p> : null}
              </div>
              {canWrite ? <Button size="sm" variant="outline" onClick={() => setEditing(container.id)}>Editar</Button> : null}
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {container.items.map((item) => <li key={item.code}>{item.code} · {item.name}: {item.onHand} {item.unit}</li>)}
              {container.items.length === 0 ? <li className="text-muted-foreground">Sem material associado. Registre uma entrada neste recipiente.</li> : null}
            </ul>
            <a className="mt-3 inline-block text-sm text-primary" href={container.qrUrl}>Abrir QR Code</a>
          </article>
        ))}
      </div>
    </div>
  );
}

export function UserEditor({
  users,
  currentUserId,
}: {
  users: { id: string; name: string; email: string; role: string; active: boolean }[];
  currentUserId: string;
}) {
  const refresh = useRefresh();
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const current = users.find((item) => item.id === editing);

  async function remove(id: string) {
    const person = users.find((item) => item.id === id);
    if (!person) return;
    if (id === currentUserId) {
      toast.error("Você não pode excluir o próprio usuário.");
      return;
    }
    if (confirming !== id) {
      setConfirming(id);
      return;
    }
    setRemoving(id);
    try {
      await mutate(`/api/users/${id}`, { method: "DELETE" });
      if (editing === id) setEditing(null);
      setConfirming(null);
      toast.success("Usuário excluído.");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir.");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <Editor title={current ? "Editar usuário" : "Novo usuário"} onSubmit={async (form) => {
      await save(editing ? `/api/users/${editing}` : "/api/users", editing ? "PATCH" : "POST", {
        name: form.get("name"), email: form.get("email"), password: String(form.get("password") || ""), role: form.get("role"), active: form.get("active") === "on",
      });
      setEditing(null); refresh();
    }}>
      <Field label="Nome"><Input name="name" key={current?.id} defaultValue={current?.name} required /></Field>
      <Field label="E-mail"><Input name="email" type="email" key={`${current?.id}-e`} defaultValue={current?.email} required /></Field>
      <Field label="Senha" hint={current ? "Deixe em branco para manter a senha atual." : "Mínimo de 8 caracteres."}><Input name="password" type="password" minLength={current ? undefined : 8} /></Field>
      <Field label="Perfil">
        <FilterMenu
          key={`${current?.id || "new"}-r`}
          name="role"
          value={current?.role || "VIEWER"}
          options={Object.entries(roleLabels).map(([value, label]) => ({ value, label }))}
        />
      </Field>
      <Active key={current?.id || "new"} checked={current?.active ?? true} />
      {current ? (
        <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setEditing(null)}>
          Cancelar
        </Button>
      ) : null}
      <Rows
        rows={users.map((item) => ({ id: item.id, title: item.name, meta: `${item.email} · ${roleLabels[item.role as keyof typeof roleLabels]}`, active: item.active }))}
        onEdit={setEditing}
        onDelete={remove}
        onCancelDelete={() => setConfirming(null)}
        deletingId={removing}
        confirmingId={confirming}
        lockedId={currentUserId}
      />
    </Editor>
  );
}

export function SettingsForm({
  settings,
}: {
  settings: { allowNegativeStock: boolean; companyName: string; integrationEnabled: boolean; integrationApiKey: string };
}) {
  const refresh = useRefresh();
  const [key, setKey] = useState(settings.integrationApiKey);
  return (
    <Editor title="Parâmetros" onSubmit={async (form) => {
      await save("/api/settings", "PUT", {
        companyName: form.get("companyName"),
        allowNegativeStock: form.get("allowNegativeStock") === "on",
        integrationEnabled: form.get("integrationEnabled") === "on",
        integrationApiKey: key,
      });
      refresh();
    }}>
      <Field label="Nome exibido"><Input name="companyName" defaultValue={settings.companyName} required /></Field>
      <label className="flex items-center gap-2 text-sm"><input name="allowNegativeStock" type="checkbox" defaultChecked={settings.allowNegativeStock} /> Permitir estoque negativo nas saídas</label>
      <label className="flex items-center gap-2 text-sm"><input name="integrationEnabled" type="checkbox" defaultChecked={settings.integrationEnabled} /> Habilitar a API de integração</label>
      <Field label="Chave da API" hint="Guarde a chave. Ela não volta a ser exibida por completo.">
        <div className="flex gap-2">
          <Input value={key} onChange={(event) => setKey(event.target.value)} />
          <Button type="button" variant="outline" onClick={() => setKey(crypto.randomUUID().replaceAll("-", ""))}>Gerar</Button>
        </div>
      </Field>
    </Editor>
  );
}

function Editor({ title, onSubmit, children }: { title: string; onSubmit: (form: FormData) => Promise<void>; children: React.ReactNode }) {
  const [pending, setPending] = useState(false);
  const parts = Children.toArray(children);
  const list = parts.filter((child) => isValidElement(child) && child.type === Rows);
  const fields = parts.filter((child) => !(isValidElement(child) && child.type === Rows));
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[340px_1fr]">
      <form
        className="space-y-3 rounded-xl border border-border bg-card p-4"
        method="post"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          try {
            await onSubmit(new FormData(event.currentTarget));
            toast.success("Registro salvo.");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Falha ao salvar.");
          } finally {
            setPending(false);
          }
        }}
      >
        <h2 className="font-semibold">{title}</h2>
        {fields}
        <Button disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
      </form>
      {list.length > 0 ? <div className="space-y-2">{list}</div> : null}
    </div>
  );
}

function Active({ checked }: { checked: boolean }) {
  return <label className="flex items-center gap-2 text-sm"><input name="active" type="checkbox" defaultChecked={checked} /> Ativo</label>;
}

function Rows({
  rows,
  onEdit,
  onDelete,
  onCancelDelete,
  deletingId,
  confirmingId,
  lockedId,
}: {
  rows: { id: string; title: string; meta: string; active: boolean }[];
  onEdit: (id: string) => void;
  onDelete?: (id: string) => void;
  onCancelDelete?: () => void;
  deletingId?: string | null;
  confirmingId?: string | null;
  lockedId?: string;
}) {
  return (
    <div className="space-y-2 lg:col-start-2 lg:row-start-1">
      {rows.map((row) =>
        onDelete ? (
          <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <div className="min-w-0">
              <span className="font-medium">{row.title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{row.meta} · {row.active ? "Ativo" : "Inativo"}</span>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={() => onEdit(row.id)}>
                Editar
              </Button>
              {confirmingId === row.id ? (
                <Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={onCancelDelete}>
                  Cancelar
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="danger"
                className="cursor-pointer"
                disabled={row.id === lockedId || deletingId === row.id}
                onClick={() => onDelete(row.id)}
              >
                {deletingId === row.id ? "Excluindo..." : confirmingId === row.id ? "Confirmar" : "Excluir"}
              </Button>
            </div>
          </div>
        ) : (
          <button key={row.id} type="button" onClick={() => onEdit(row.id)} className="block w-full rounded-xl border border-border bg-card px-4 py-3 text-left">
            <span className="font-medium">{row.title}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{row.meta} · {row.active ? "Ativo" : "Inativo"}</span>
          </button>
        ),
      )}
    </div>
  );
}

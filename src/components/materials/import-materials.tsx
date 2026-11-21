"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mutate } from "@/lib/client";

export function ImportMaterials() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onChange(file: File) {
    const body = new FormData();
    body.set("file", file);
    setPending(true);
    try {
      const result = await mutate<{ created: number; errors: { line: number; message: string }[] }>("/api/materials/import", {
        method: "POST",
        body,
      });
      if (result.errors.length) {
        toast.error(`${result.created} importados. ${result.errors.length} linhas com erro. Primeira: ${result.errors[0].message}`);
      } else {
        toast.success(`${result.created} materiais importados.`);
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na importação.");
    } finally {
      setPending(false);
    }
  }

  return (
    <label className="inline-flex h-10 cursor-pointer items-center rounded-lg border border-border px-4 text-sm">
      {pending ? "Importando..." : "Importar CSV"}
      <input type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => event.target.files?.[0] && onChange(event.target.files[0])} />
    </label>
  );
}

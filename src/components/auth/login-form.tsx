"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { mutate } from "@/lib/client";

export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      await mutate("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      router.push("/painel");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no acesso.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form method="post" action="/login" onSubmit={onSubmit} className="space-y-4">
      <Field label="E-mail">
        <Input name="email" type="email" autoComplete="username" required placeholder="admin@ekanban.local" />
      </Field>
      <Field label="Senha">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button className="w-full" disabled={pending}>
        {pending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}

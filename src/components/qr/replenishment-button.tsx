"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mutate } from "@/lib/client";

export function ReplenishmentButton({ materialId, locationId }: { materialId: string; locationId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function request() {
    setPending(true);
    try {
      await mutate("/api/replenishments", {
        method: "POST",
        body: JSON.stringify({ materialId, locationId, quantity: 1, priority: "MEDIUM", status: "REQUESTED" }),
      });
      toast.success("Reposição solicitada.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível solicitar.");
    } finally {
      setPending(false);
    }
  }

  return <Button onClick={request} disabled={pending}>{pending ? "Solicitando..." : "Solicitar reposição"}</Button>;
}

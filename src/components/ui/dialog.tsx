"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ className, children, ...props }: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(100%-1.5rem,40rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-2xl",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted">
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ children }: { children: ReactNode }) {
  return <div className="mb-4 space-y-1 pr-8">{children}</div>;
}

export function DialogTitle({ children }: { children: ReactNode }) {
  return <DialogPrimitive.Title className="text-lg font-semibold">{children}</DialogPrimitive.Title>;
}

export function DialogDescription({ children }: { children: ReactNode }) {
  return <DialogPrimitive.Description className="text-sm text-muted-foreground">{children}</DialogPrimitive.Description>;
}

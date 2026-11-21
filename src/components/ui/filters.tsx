"use client";

import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };

const control =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none ring-ring placeholder:text-muted-foreground focus:ring-2";

export function FilterBar({
  action,
  clearHref,
  columns,
  children,
}: {
  action: string;
  clearHref: string;
  columns: string;
  children: ReactNode;
}) {
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    for (const field of event.currentTarget.querySelectorAll<HTMLInputElement>("input")) {
      if (!field.value) field.disabled = true;
    }
  }

  return (
    <form action={action} onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-4">
      <div className={cn("grid items-end gap-3 md:grid-cols-2", columns)}>
        {children}
        <div className="flex gap-2 md:col-span-2 xl:col-span-1">
          <Button type="submit">Filtrar</Button>
          <Button variant="outline" asChild>
            <Link href={clearHref}>Limpar</Link>
          </Button>
        </div>
      </div>
    </form>
  );
}

export function FilterField({ label, className, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="min-w-0">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <input {...props} className={cn(control, props.type === "date" && "dark:[color-scheme:dark]", className)} />
    </label>
  );
}

export function FilterMenu({
  name,
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  name: string;
  label?: string;
  value: string;
  options: FilterOption[];
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  const [current, setCurrent] = useState(value);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === current) ?? options[0];

  useEffect(() => {
    setCurrent(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      {label ? <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span> : null}
      <input type="hidden" name={name} value={current} />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((next) => !next)}
        className={cn(control, "flex items-center justify-between gap-2 text-left disabled:opacity-50")}
      >
        <span className="truncate">{selected?.label}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-background p-1 shadow-xl"
        >
          {options.map((option) => {
            const active = option.value === current;
            return (
              <li key={`${name}-${option.value || "all"}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-muted",
                    active && "bg-primary/15 text-primary",
                  )}
                  onClick={() => {
                    setCurrent(option.value);
                    setOpen(false);
                    onChange?.(option.value);
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {active ? <Check className="size-4 shrink-0" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

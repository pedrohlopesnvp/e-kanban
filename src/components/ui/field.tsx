import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
      {children}
    </label>
  );
}

const control =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none ring-ring placeholder:text-muted-foreground focus:ring-2";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(control, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(control, "min-h-24 py-2", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(control, props.className)} />;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

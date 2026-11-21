import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const tones = {
  blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  green: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  yellow: "bg-amber-500/15 text-amber-700 dark:text-amber-200",
  red: "bg-red-500/15 text-red-700 dark:text-red-300",
  orange: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  violet: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  muted: "bg-muted text-muted-foreground",
};

export function Badge({
  tone = "muted",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)}
      {...props}
    />
  );
}

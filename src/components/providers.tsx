"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import type { ReactNode } from "react";

function ToastHost() {
  const { resolvedTheme } = useTheme();
  return <Toaster richColors closeButton theme={resolvedTheme === "light" ? "light" : "dark"} />;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      {children}
      <ToastHost />
    </ThemeProvider>
  );
}

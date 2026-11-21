"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeftRight,
  Box,
  FileBarChart,
  Kanban,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Moon,
  Package,
  ScanLine,
  Settings,
  Sun,
  Tags,
  Truck,
  Users,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import type { Role } from "@prisma/client";
import { roleLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

const hiddenNav = new Set(["/recipientes", "/localizacoes", "/categorias", "/fornecedores", "/relatorios"]);

const links = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard },
  { href: "/kanban", label: "Kanban", icon: Kanban },
  { href: "/materiais", label: "Materiais", icon: Package },
  { href: "/estoque", label: "Estoque", icon: ArrowLeftRight },
  { href: "/recipientes", label: "Recipientes", icon: Box },
  { href: "/localizacoes", label: "Localizações", icon: MapPin },
  { href: "/categorias", label: "Categorias", icon: Tags },
  { href: "/fornecedores", label: "Fornecedores", icon: Truck },
  { href: "/relatorios", label: "Relatórios", icon: FileBarChart },
  { href: "/scanner", label: "Gerenciar Kanban", icon: ScanLine },
].filter((link) => !hiddenNav.has(link.href));

export function AppShell({
  user,
  companyName,
  children,
}: {
  user: { name: string; email: string; role: Role };
  companyName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const items = user.role === "ADMIN" ? [...links, { href: "/usuarios", label: "Usuários", icon: Users }, { href: "/configuracoes", label: "Configurações", icon: Settings }] : links;

  async function logout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  const nav = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground">EK</div>
        <div>
          <p className="text-sm font-semibold text-sidebar-foreground">{companyName}</p>
          <p className="text-xs text-sidebar-foreground/60">Controle de materiais</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {items.map((item) => {
          const active = item.href === "/painel" ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/75 hover:bg-white/5 hover:text-sidebar-foreground",
                active && "bg-white/10 text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-3 border-t border-white/10 p-4">
        <div>
          <p className="truncate text-sm font-medium text-sidebar-foreground">{user.name}</p>
          <p className="truncate text-xs text-sidebar-foreground/60">{roleLabels[user.role]}</p>
        </div>
        <button onClick={logout} className="flex items-center gap-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground">
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-sidebar md:block">{nav}</aside>
      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-label="Fechar menu" />
          <aside className="relative h-full w-72 bg-sidebar">{nav}</aside>
        </div>
      ) : null}
      <div className="md:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:px-8">
          <button className="rounded-lg p-2 hover:bg-muted md:hidden" onClick={() => setOpen((value) => !value)} aria-label="Abrir menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <p className="hidden text-sm text-muted-foreground md:block">Disponibilidade, reposição e rastreio no mesmo fluxo</p>
          <button
            className="rounded-lg border border-border p-2 hover:bg-muted"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Alternar tema"
          >
            {resolvedTheme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
        </header>
        <main className="px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}

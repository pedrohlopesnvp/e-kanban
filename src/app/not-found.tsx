import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <Link href="/painel" className="text-primary">Voltar ao painel</Link>
    </main>
  );
}

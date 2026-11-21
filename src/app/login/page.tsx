import { LoginForm } from "@/components/auth/login-form";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/painel");
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1b212c] px-4">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#232b39] p-8 text-[#e8edf4] shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#60a5fa] font-semibold text-[#0b1220]">EK</div>
          <div>
            <h1 className="text-2xl font-semibold">E-Kanban</h1>
            <p className="text-sm text-[#9aa6b8]">Materiais, estoque e reposição</p>
          </div>
        </div>
        <LoginForm />
        <div className="mt-6 rounded-lg bg-white/5 p-3 text-xs leading-5 text-[#9aa6b8]">
          <p className="mb-1 font-medium text-[#e8edf4]">Contas de demonstração</p>
          <p>admin@ekanban.local / Admin@123</p>
          <p>operador@ekanban.local / Operador@123</p>
          <p>visualizador@ekanban.local / Visual@123</p>
        </div>
      </section>
    </main>
  );
}

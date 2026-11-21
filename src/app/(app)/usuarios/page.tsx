import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { UserEditor } from "@/components/catalog/editors";
import { requirePageUser } from "@/server/auth/permissions";

export default async function UsersPage() {
  const user = await requirePageUser();
  if (user.role !== "ADMIN") redirect("/painel");
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true },
    orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Usuários</h1>
        <p className="text-sm text-muted-foreground">Administrador, operador e visualizador.</p>
      </div>
      <UserEditor users={users} currentUserId={user.id} />
    </div>
  );
}

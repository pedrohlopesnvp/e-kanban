import { prisma } from "@/lib/db";
import { ContainerEditor } from "@/components/catalog/editors";
import { canWriteMasterData, requirePageUser } from "@/server/auth/permissions";
import { listContainers } from "@/server/catalog/catalog-service";

export default async function ContainersPage() {
  const user = await requirePageUser();
  const [containers, locations] = await Promise.all([
    listContainers(),
    prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Recipientes</h1>
        <p className="text-sm text-muted-foreground">Caixas, gavetas e prateleiras. O par de duas caixas dispara a reposição quando a caixa de disparo chega a zero.</p>
      </div>
      <ContainerEditor containers={containers} locations={locations} canWrite={canWriteMasterData(user.role)} />
    </div>
  );
}

import { prisma } from "@/lib/db";
import { LocationEditor } from "@/components/catalog/editors";
import { canWriteMasterData, requirePageUser } from "@/server/auth/permissions";

export default async function LocationsPage() {
  const user = await requirePageUser();
  const locations = await prisma.location.findMany({ orderBy: { code: "asc" } });
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Localizações</h1>
        <p className="text-sm text-muted-foreground">Almoxarifados, oficinas e pontos de guarda.</p>
      </div>
      {canWriteMasterData(user.role) ? <LocationEditor locations={locations} /> : (
        <ul className="space-y-2">{locations.map((location) => <li key={location.id} className="rounded-xl border border-border bg-card px-4 py-3">{location.code} · {location.name}</li>)}</ul>
      )}
    </div>
  );
}

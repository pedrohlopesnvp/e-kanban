import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/catalog/editors";
import { requirePageUser } from "@/server/auth/permissions";
import { getSettings } from "@/server/settings";

export default async function SettingsPage() {
  const user = await requirePageUser();
  if (user.role !== "ADMIN") redirect("/painel");
  const settings = await getSettings();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Parâmetros operacionais e a chave reservada para uma integração futura.</p>
      </div>
      <SettingsForm settings={settings} />
    </div>
  );
}

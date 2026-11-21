import { AppShell } from "@/components/layout/app-shell";
import { requirePageUser } from "@/server/auth/permissions";
import { getSettings } from "@/server/settings";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const settings = await getSettings();
  return (
    <AppShell user={user} companyName={settings.companyName}>
      {children}
    </AppShell>
  );
}

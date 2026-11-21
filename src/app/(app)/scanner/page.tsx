import { QrScanner } from "@/components/qr/scanner";
import { canMoveStock, requirePageUser } from "@/server/auth/permissions";

export default async function ScannerPage() {
  const user = await requirePageUser();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Gerenciar Kanban</h1>
        <p className="text-sm text-muted-foreground">Abra a câmera e aponte para o código do material ou do recipiente.</p>
      </div>
      <QrScanner canEdit={canMoveStock(user.role)} />
    </div>
  );
}

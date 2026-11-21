"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mutate } from "@/lib/client";
import { binRoleLabels, containerTypeLabels } from "@/lib/labels";
import { formatQty } from "@/lib/numbers";
import { MaterialScanResult, type ScannedContainer, type ScannedMaterial } from "@/components/qr/scan-result";

type ScanHit = ScannedMaterial | ScannedContainer;

type Scanner = {
  isScanning: boolean;
  start: (
    camera: { facingMode: string },
    config: { fps: number; qrbox: { width: number; height: number } },
    onSuccess: (text: string) => void,
    onError: () => void,
  ) => Promise<unknown>;
  stop: () => Promise<void>;
  clear: () => void;
};

export function QrScanner({ canEdit }: { canEdit: boolean }) {
  const scannerRef = useRef<Scanner | null>(null);
  const busyRef = useRef(false);
  const identifyRef = useRef<(code: string) => void>(() => undefined);
  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [material, setMaterial] = useState<ScannedMaterial | null>(null);
  const [container, setContainer] = useState<ScannedContainer | null>(null);

  useEffect(() => {
    if (!cameraOn) return;
    let active = true;
    let local: Scanner | null = null;
    (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (!active) return;
        const instance = new Html5Qrcode("code-reader", {
          verbose: false,
          useBarCodeDetectorIfSupported: true,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.CODABAR,
          ],
        });
        local = instance;
        scannerRef.current = instance;
        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 280, height: 140 } },
          (text) => {
            identifyRef.current(text);
          },
          () => undefined,
        );
      } catch {
        if (active) {
          setError("Não foi possível acessar a câmera. Verifique a permissão do navegador.");
          setCameraOn(false);
        }
      }
    })();
    return () => {
      active = false;
      const current = local ?? scannerRef.current;
      scannerRef.current = null;
      void stopScanner(current);
    };
  }, [cameraOn]);

  async function identify(code: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setReading(true);
    setError(null);
    try {
      const hit = await mutate<ScanHit>(`/api/scan?code=${encodeURIComponent(code)}`);
      if (hit.kind === "material") {
        setMaterial(hit);
        setContainer(null);
      } else {
        setContainer(hit);
        setMaterial(null);
      }
      setCameraOn(false);
    } catch (lookupError) {
      const message = lookupError instanceof Error ? lookupError.message : "Código não reconhecido.";
      setError(message);
      toast.error(message);
    } finally {
      busyRef.current = false;
      setReading(false);
    }
  }

  identifyRef.current = (code) => {
    void identify(code);
  };

  const hasResult = Boolean(material || container);

  function openCamera() {
    setMaterial(null);
    setContainer(null);
    setError(null);
    setCameraOn(true);
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      {cameraOn || !hasResult ? (
        <div className="relative mx-auto flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-black">
          <div
            id="code-reader"
            className={cameraOn ? "absolute inset-0 [&_video]:h-full! [&_video]:w-full! [&_video]:object-cover" : "hidden"}
          />
          {cameraOn ? null : (
            <Button type="button" className="cursor-pointer" onClick={openCamera}>
              Abrir câmera
            </Button>
          )}
        </div>
      ) : (
        <div className="flex justify-center">
          <Button type="button" className="cursor-pointer" onClick={openCamera}>
            Realizar Nova Leitura
          </Button>
        </div>
      )}
      {cameraOn ? (
        <p className="text-center text-sm text-muted-foreground">{reading ? "Identificando..." : "Aponte para o código."}</p>
      ) : null}
      {error ? <p className="text-center text-sm text-danger">{error}</p> : null}
      {material ? (
        <MaterialScanResult key={material.id} material={material} canEdit={canEdit} onUpdated={setMaterial} />
      ) : null}
      {container ? (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div>
            <p className="text-xs text-muted-foreground">{containerTypeLabels[container.type as keyof typeof containerTypeLabels] || container.type}</p>
            <h2 className="text-lg font-semibold">{container.code}</h2>
            <p className="text-sm text-muted-foreground">
              {container.locationName} · {binRoleLabels[container.binRole as keyof typeof binRoleLabels] || container.binRole}
            </p>
            {container.description ? <p className="mt-1 text-sm">{container.description}</p> : null}
          </div>
          <ul className="space-y-2">
            {container.items.map((item) => (
              <li key={item.materialId}>
                <button type="button" className="w-full rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => void identify(item.code)}>
                  {item.code} · {item.name} · {formatQty(item.available, item.unit)}
                </button>
              </li>
            ))}
            {container.items.length === 0 ? <li className="text-sm text-muted-foreground">Nenhum material neste recipiente.</li> : null}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

async function stopScanner(scanner: Scanner | null) {
  if (!scanner) return;
  try {
    if (scanner.isScanning) await scanner.stop();
  } catch {
    // A câmera já pode ter sido encerrada.
  }
  try {
    scanner.clear();
  } catch {
    // O leitor já foi limpo.
  }
}

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type Db = Prisma.TransactionClient | typeof prisma;

const defaults = {
  allowNegativeStock: "false",
  companyName: "E-Kanban",
  integrationEnabled: "false",
  integrationApiKey: "",
} as const;

export type AppSettings = {
  allowNegativeStock: boolean;
  companyName: string;
  integrationEnabled: boolean;
  integrationApiKey: string;
};

export async function getSettings(db: Db = prisma): Promise<AppSettings> {
  const rows = await db.setting.findMany();
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    allowNegativeStock: (map.get("allowNegativeStock") ?? defaults.allowNegativeStock) === "true",
    companyName: map.get("companyName") ?? defaults.companyName,
    integrationEnabled: (map.get("integrationEnabled") ?? defaults.integrationEnabled) === "true",
    integrationApiKey: map.get("integrationApiKey") ?? defaults.integrationApiKey,
  };
}

export async function saveSettings(db: Db, settings: AppSettings) {
  const entries: [string, string][] = [
    ["allowNegativeStock", settings.allowNegativeStock ? "true" : "false"],
    ["companyName", settings.companyName],
    ["integrationEnabled", settings.integrationEnabled ? "true" : "false"],
    ["integrationApiKey", settings.integrationApiKey],
  ];
  for (const [key, value] of entries) {
    await db.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
}

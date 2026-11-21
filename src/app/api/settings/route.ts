import { requireRoles } from "@/server/auth/permissions";
import { updateSettings } from "@/server/catalog/catalog-service";
import { errorResponse, json, readJson } from "@/server/http";
import { getSettings } from "@/server/settings";
import { settingsSchema } from "@/server/validators";

export async function GET() {
  try {
    await requireRoles(["ADMIN"]);
    const settings = await getSettings();
    return json({ ...settings, integrationApiKey: settings.integrationApiKey ? "••••••••" : "" });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireRoles(["ADMIN"]);
    const input = settingsSchema.parse(await readJson(request));
    const current = await getSettings();
    const integrationApiKey =
      !input.integrationApiKey || input.integrationApiKey.includes("•")
        ? current.integrationApiKey
        : input.integrationApiKey;
    await updateSettings(user, { ...input, integrationApiKey: integrationApiKey || "" });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

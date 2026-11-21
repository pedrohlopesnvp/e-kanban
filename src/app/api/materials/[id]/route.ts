import { requireRoles, requireUser } from "@/server/auth/permissions";
import { errorResponse, json, readJson } from "@/server/http";
import { getMaterial, materialQr, updateMaterial } from "@/server/materials/material-service";
import { materialSchema } from "@/server/validators";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    await requireUser();
    const { id } = await context.params;
    const [material, qr] = await Promise.all([getMaterial(id), materialQr(id)]);
    return json({ material, qr });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireRoles(["ADMIN"]);
    const { id } = await context.params;
    const input = materialSchema.parse(await readJson(request));
    return json(await updateMaterial(user, id, input));
  } catch (error) {
    return errorResponse(error);
  }
}

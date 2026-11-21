import { requireRoles } from "@/server/auth/permissions";
import { saveSupplier } from "@/server/catalog/catalog-service";
import { errorResponse, json, readJson } from "@/server/http";
import { supplierSchema } from "@/server/validators";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireRoles(["ADMIN"]);
    const { id } = await context.params;
    return json(await saveSupplier(user, supplierSchema.parse(await readJson(request)), id));
  } catch (error) {
    return errorResponse(error);
  }
}

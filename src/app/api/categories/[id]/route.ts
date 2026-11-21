import { requireRoles } from "@/server/auth/permissions";
import { saveCategory } from "@/server/catalog/catalog-service";
import { errorResponse, json, readJson } from "@/server/http";
import { categorySchema } from "@/server/validators";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireRoles(["ADMIN"]);
    const { id } = await context.params;
    const input = categorySchema.parse(await readJson(request));
    return json(await saveCategory(user, input, id));
  } catch (error) {
    return errorResponse(error);
  }
}

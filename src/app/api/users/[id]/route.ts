import { requireRoles } from "@/server/auth/permissions";
import { deleteUser, saveUser } from "@/server/catalog/catalog-service";
import { errorResponse, json, readJson } from "@/server/http";
import { userSchema } from "@/server/validators";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireRoles(["ADMIN"]);
    const { id } = await context.params;
    return json(await saveUser(user, userSchema.parse(await readJson(request)), id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const user = await requireRoles(["ADMIN"]);
    const { id } = await context.params;
    await deleteUser(user, id);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

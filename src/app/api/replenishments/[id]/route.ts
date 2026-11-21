import { canOperateKanban, requireUser } from "@/server/auth/permissions";
import { AppError } from "@/lib/errors";
import { errorResponse, json, readJson } from "@/server/http";
import { changeReplenishmentStatus, getReplenishment } from "@/server/kanban/replenishment";
import { statusSchema } from "@/server/validators";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    await requireUser();
    const { id } = await context.params;
    return json(await getReplenishment(id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser();
    if (!canOperateKanban(user.role)) throw new AppError("Seu perfil não pode alterar a reposição.", 403);
    const { id } = await context.params;
    const input = statusSchema.parse(await readJson(request));
    return json(await changeReplenishmentStatus(user, id, input.status, input.note));
  } catch (error) {
    return errorResponse(error);
  }
}

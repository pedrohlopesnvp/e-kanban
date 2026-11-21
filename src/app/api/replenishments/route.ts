import { canOperateKanban, requireUser } from "@/server/auth/permissions";
import { AppError } from "@/lib/errors";
import { errorResponse, json, readJson } from "@/server/http";
import { createManualReplenishment } from "@/server/kanban/replenishment";
import { replenishmentSchema } from "@/server/validators";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!canOperateKanban(user.role)) throw new AppError("Seu perfil não pode solicitar reposição.", 403);
    const input = replenishmentSchema.parse(await readJson(request));
    return json(await createManualReplenishment(user, input), 201);
  } catch (error) {
    return errorResponse(error);
  }
}

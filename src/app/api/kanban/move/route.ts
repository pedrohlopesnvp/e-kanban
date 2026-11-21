import { canOperateKanban, requireUser } from "@/server/auth/permissions";
import { AppError } from "@/lib/errors";
import { errorResponse, json, readJson } from "@/server/http";
import { moveKanbanCard } from "@/server/kanban/replenishment";
import { kanbanMoveSchema } from "@/server/validators";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!canOperateKanban(user.role)) throw new AppError("Seu perfil não pode mover cartões.", 403);
    const input = kanbanMoveSchema.parse(await readJson(request));
    return json(await moveKanbanCard(user, input.cardId, input.toColumn));
  } catch (error) {
    return errorResponse(error);
  }
}

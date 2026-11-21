import type { MovementType } from "@prisma/client";
import { canMoveStock, requireUser } from "@/server/auth/permissions";
import { AppError } from "@/lib/errors";
import { errorResponse, json, readJson } from "@/server/http";
import { listMovements, registerMovement } from "@/server/stock/movement-service";
import { movementSchema, readPage } from "@/server/validators";

const types = new Set(["IN", "OUT", "ADJUSTMENT", "TRANSFER", "RESERVE", "RELEASE", "RETURN"]);

export async function GET(request: Request) {
  try {
    await requireUser();
    const url = new URL(request.url);
    const page = readPage(url.searchParams);
    const type = url.searchParams.get("type");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    return json(
      await listMovements({
        materialId: url.searchParams.get("materialId") || undefined,
        type: type && types.has(type) ? (type as MovementType) : undefined,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        page: page.page,
        pageSize: page.pageSize,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!canMoveStock(user.role)) throw new AppError("Seu perfil não pode movimentar estoque.", 403);
    const input = movementSchema.parse(await readJson(request));
    const idempotencyKey = request.headers.get("idempotency-key") || input.idempotencyKey;
    return json(
      await registerMovement({ ...input, userId: user.id, idempotencyKey }),
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}

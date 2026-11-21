import { requireRoles, requireUser } from "@/server/auth/permissions";
import { qrDataUrl, saveContainer } from "@/server/catalog/catalog-service";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { errorResponse, json, readJson } from "@/server/http";
import { containerSchema } from "@/server/validators";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    await requireUser();
    const { id } = await context.params;
    const container = await prisma.container.findUnique({ where: { id } });
    if (!container) throw new AppError("Recipiente não encontrado.", 404);
    return json({ dataUrl: await qrDataUrl(container.publicToken), url: `/q/${container.publicToken}` });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireRoles(["ADMIN"]);
    const { id } = await context.params;
    return json(await saveContainer(user, containerSchema.parse(await readJson(request)), id));
  } catch (error) {
    return errorResponse(error);
  }
}

import { prisma } from "@/lib/db";
import { requireRoles, requireUser } from "@/server/auth/permissions";
import { saveLocation } from "@/server/catalog/catalog-service";
import { errorResponse, json, readJson } from "@/server/http";
import { locationSchema } from "@/server/validators";

export async function GET() {
  try {
    await requireUser();
    return json({ locations: await prisma.location.findMany({ orderBy: { code: "asc" } }) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRoles(["ADMIN"]);
    return json(await saveLocation(user, locationSchema.parse(await readJson(request))), 201);
  } catch (error) {
    return errorResponse(error);
  }
}

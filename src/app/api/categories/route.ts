import { requireRoles, requireUser } from "@/server/auth/permissions";
import { saveCategory } from "@/server/catalog/catalog-service";
import { prisma } from "@/lib/db";
import { errorResponse, json, readJson } from "@/server/http";
import { categorySchema } from "@/server/validators";

export async function GET() {
  try {
    await requireUser();
    const categories = await prisma.category.findMany({ orderBy: [{ parentId: "asc" }, { name: "asc" }] });
    return json({ categories });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRoles(["ADMIN"]);
    const input = categorySchema.parse(await readJson(request));
    return json(await saveCategory(user, input), 201);
  } catch (error) {
    return errorResponse(error);
  }
}

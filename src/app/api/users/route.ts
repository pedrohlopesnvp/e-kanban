import { prisma } from "@/lib/db";
import { requireRoles } from "@/server/auth/permissions";
import { saveUser } from "@/server/catalog/catalog-service";
import { errorResponse, json, readJson } from "@/server/http";
import { userSchema } from "@/server/validators";

export async function GET() {
  try {
    await requireRoles(["ADMIN"]);
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
      orderBy: { name: "asc" },
    });
    return json({ users });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRoles(["ADMIN"]);
    return json(await saveUser(user, userSchema.parse(await readJson(request))), 201);
  } catch (error) {
    return errorResponse(error);
  }
}

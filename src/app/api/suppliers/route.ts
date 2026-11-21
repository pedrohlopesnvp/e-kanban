import { prisma } from "@/lib/db";
import { requireRoles, requireUser } from "@/server/auth/permissions";
import { saveSupplier } from "@/server/catalog/catalog-service";
import { errorResponse, json, readJson } from "@/server/http";
import { supplierSchema } from "@/server/validators";

export async function GET() {
  try {
    await requireUser();
    return json({ suppliers: await prisma.supplier.findMany({ orderBy: { name: "asc" } }) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRoles(["ADMIN"]);
    return json(await saveSupplier(user, supplierSchema.parse(await readJson(request))), 201);
  } catch (error) {
    return errorResponse(error);
  }
}

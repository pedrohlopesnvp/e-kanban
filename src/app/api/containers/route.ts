import { requireRoles, requireUser } from "@/server/auth/permissions";
import { listContainers, saveContainer } from "@/server/catalog/catalog-service";
import { errorResponse, json, readJson } from "@/server/http";
import { containerSchema } from "@/server/validators";

export async function GET() {
  try {
    await requireUser();
    return json({ containers: await listContainers() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRoles(["ADMIN"]);
    return json(await saveContainer(user, containerSchema.parse(await readJson(request))), 201);
  } catch (error) {
    return errorResponse(error);
  }
}

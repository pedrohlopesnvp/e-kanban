import { requireRoles, requireUser } from "@/server/auth/permissions";
import { errorResponse, json, readJson } from "@/server/http";
import { createMaterial, listMaterials } from "@/server/materials/material-service";
import { materialSchema, readPage } from "@/server/validators";

export async function GET(request: Request) {
  try {
    await requireUser();
    const url = new URL(request.url);
    const page = readPage(url.searchParams);
    return json(
      await listMaterials({
        q: url.searchParams.get("q") || undefined,
        categoryId: url.searchParams.get("categoryId") || undefined,
        availability: url.searchParams.get("availability") || undefined,
        active: url.searchParams.get("active") || undefined,
        sort: url.searchParams.get("sort") || undefined,
        dir: url.searchParams.get("dir") || undefined,
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
    const user = await requireRoles(["ADMIN"]);
    const input = materialSchema.parse(await readJson(request));
    return json(await createMaterial(user, input), 201);
  } catch (error) {
    return errorResponse(error);
  }
}

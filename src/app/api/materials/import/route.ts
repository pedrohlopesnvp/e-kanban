import { requireRoles } from "@/server/auth/permissions";
import { AppError } from "@/lib/errors";
import { errorResponse, json } from "@/server/http";
import { importMaterialsCsv } from "@/server/materials/material-service";

export async function POST(request: Request) {
  try {
    const user = await requireRoles(["ADMIN"]);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("Selecione um arquivo CSV.");
    const text = await file.text();
    return json(await importMaterialsCsv(user, text));
  } catch (error) {
    return errorResponse(error);
  }
}

import { requireUser } from "@/server/auth/permissions";
import { errorResponse } from "@/server/http";
import { exportMaterialsCsv } from "@/server/materials/material-service";

export async function GET() {
  try {
    await requireUser();
    const csv = await exportMaterialsCsv();
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=materiais.csv",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

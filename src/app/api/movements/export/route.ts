import Papa from "papaparse";
import { requireUser } from "@/server/auth/permissions";
import { errorResponse } from "@/server/http";
import { listMovements } from "@/server/stock/movement-service";
import type { MovementType } from "@prisma/client";

const types = new Set(["IN", "OUT", "ADJUSTMENT", "TRANSFER", "RESERVE", "RELEASE", "RETURN"]);

export async function GET(request: Request) {
  try {
    await requireUser();
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const data = await listMovements({
      type: type && types.has(type) ? (type as MovementType) : undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(`${to}T23:59:59`) : undefined,
      page: 1,
      pageSize: 1000,
    });
    const csv = Papa.unparse(data.items);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=movimentacoes.csv",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

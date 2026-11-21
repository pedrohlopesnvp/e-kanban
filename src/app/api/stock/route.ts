import { requireUser } from "@/server/auth/permissions";
import { errorResponse, json } from "@/server/http";
import { listBalances } from "@/server/stock/movement-service";
import { readPage } from "@/server/validators";

export async function GET(request: Request) {
  try {
    await requireUser();
    const url = new URL(request.url);
    const page = readPage(url.searchParams);
    return json(
      await listBalances({
        q: url.searchParams.get("q") || undefined,
        locationId: url.searchParams.get("locationId") || undefined,
        page: page.page,
        pageSize: page.pageSize,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

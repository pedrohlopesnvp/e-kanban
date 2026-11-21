import { requireUser } from "@/server/auth/permissions";
import { errorResponse, json } from "@/server/http";
import { getDashboard } from "@/server/dashboard/dashboard-service";

export async function GET(request: Request) {
  try {
    await requireUser();
    const days = Number(new URL(request.url).searchParams.get("days") || 30);
    return json(await getDashboard(days));
  } catch (error) {
    return errorResponse(error);
  }
}

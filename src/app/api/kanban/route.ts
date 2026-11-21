import type { Priority } from "@prisma/client";
import { requireUser } from "@/server/auth/permissions";
import { errorResponse, json } from "@/server/http";
import { getKanbanBoard } from "@/server/kanban/replenishment";

const priorities = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export async function GET(request: Request) {
  try {
    await requireUser();
    const url = new URL(request.url);
    const priority = url.searchParams.get("priority");
    return json({
      cards: await getKanbanBoard({
        q: url.searchParams.get("q") || undefined,
        categoryId: url.searchParams.get("categoryId") || undefined,
        locationId: url.searchParams.get("locationId") || undefined,
        priority: priority && priorities.has(priority) ? (priority as Priority) : undefined,
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

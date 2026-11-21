import { errorResponse, json } from "@/server/http";
import { authorizeIntegration, integrationMovements } from "@/server/integration/integration-read";

export async function GET(request: Request) {
  try {
    await authorizeIntegration(request);
    const from = new URL(request.url).searchParams.get("from");
    return json({ movements: await integrationMovements(from ? new Date(from) : undefined) });
  } catch (error) {
    return errorResponse(error);
  }
}

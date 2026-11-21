import { errorResponse, json } from "@/server/http";
import { authorizeIntegration, integrationReplenishments } from "@/server/integration/integration-read";

export async function GET(request: Request) {
  try {
    await authorizeIntegration(request);
    return json({ replenishments: await integrationReplenishments() });
  } catch (error) {
    return errorResponse(error);
  }
}

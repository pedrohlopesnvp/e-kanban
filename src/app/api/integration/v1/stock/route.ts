import { errorResponse, json } from "@/server/http";
import { authorizeIntegration, integrationStock } from "@/server/integration/integration-read";

export async function GET(request: Request) {
  try {
    await authorizeIntegration(request);
    return json({ balances: await integrationStock() });
  } catch (error) {
    return errorResponse(error);
  }
}

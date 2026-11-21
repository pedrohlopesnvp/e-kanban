import { errorResponse, json } from "@/server/http";
import { authorizeIntegration, integrationMaterials } from "@/server/integration/integration-read";

export async function GET(request: Request) {
  try {
    await authorizeIntegration(request);
    return json({ materials: await integrationMaterials() });
  } catch (error) {
    return errorResponse(error);
  }
}

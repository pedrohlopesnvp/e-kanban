import { getSessionUser } from "@/server/auth/session";
import { errorResponse, json } from "@/server/http";

export async function GET() {
  try {
    const user = await getSessionUser();
    return json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}

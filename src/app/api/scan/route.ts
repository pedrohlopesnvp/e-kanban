import { errorResponse, json } from "@/server/http";
import { requireUser } from "@/server/auth/permissions";
import { AppError } from "@/lib/errors";
import { resolveScannedCode } from "@/server/scan/resolve-scan";

export async function GET(request: Request) {
  try {
    await requireUser();
    const code = new URL(request.url).searchParams.get("code")?.trim();
    if (!code) throw new AppError("Informe o código lido.");
    return json(await resolveScannedCode(code));
  } catch (error) {
    return errorResponse(error);
  }
}

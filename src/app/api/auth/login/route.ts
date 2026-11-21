import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/server/audit";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  createSession,
  destroySession,
  getSessionUser,
  sessionCookie,
  toPublicUser,
} from "@/server/auth/session";
import { errorResponse, json, readJson } from "@/server/http";
import { loginSchema } from "@/server/validators";

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await readJson(request));
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    const passwordMatches = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
    if (!user || !user.active || !passwordMatches) {
      throw new AppError("E-mail ou senha inválidos.", 401);
    }
    const session = await createSession(user.id);
    await writeAudit(prisma, { userId: user.id, action: "LOGIN", entity: "User", entityId: user.id });
    return json({ user: toPublicUser(user) }, 200, {
      "Set-Cookie": sessionCookie(session.token, session.expiresAt),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const user = await getSessionUser();
    await destroySession(token);
    if (user) await writeAudit(prisma, { userId: user.id, action: "LOGOUT", entity: "User", entityId: user.id });
    return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
  } catch (error) {
    return errorResponse(error);
  }
}

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import type { Role } from "@prisma/client";

export const SESSION_COOKIE = "ekanban_session";
const SESSION_DAYS = 7;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

function secret() {
  return process.env.SESSION_SECRET || "dev-only-session-secret-change-me-please-32";
}

export function hashToken(token: string) {
  return createHash("sha256").update(`${secret()}:${token}`).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function sessionCookie(token: string, expires: Date) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Expires=${expires.toUTCString()}${secure}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });
  return { token, expiresAt };
}

export async function destroySession(token: string | undefined) {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
  };
}

export function toPublicUser(user: { id: string; name: string; email: string; role: Role; active?: boolean }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active ?? true,
  };
}

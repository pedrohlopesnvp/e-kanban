import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { getSessionUser, type SessionUser } from "@/server/auth/session";

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AppError("Não autenticado.", 401, "UNAUTHENTICATED");
  return user;
}

export async function requirePageUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRoles(roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new AppError("Seu perfil não pode realizar esta operação.", 403, "FORBIDDEN");
  }
  return user;
}

export function canWriteMasterData(role: Role) {
  return role === "ADMIN";
}

export function canMoveStock(role: Role) {
  return role === "ADMIN" || role === "OPERATOR";
}

export function canOperateKanban(role: Role) {
  return role === "ADMIN" || role === "OPERATOR";
}

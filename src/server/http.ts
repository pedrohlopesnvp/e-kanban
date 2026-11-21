import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, { status, headers });
}

export async function handle<T>(action: () => Promise<T>) {
  try {
    const data = await action();
    return json(data);
  } catch (error) {
    return errorResponse(error);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message || "Dados inválidos.";
    return json({ error: message, issues: error.flatten() }, 422);
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return json({ error: "Já existe um registro com este código.", code: "DUPLICATE" }, 409);
  }
  console.error(error);
  return json({ error: "Não foi possível concluir a operação.", code: "INTERNAL" }, 500);
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new AppError("O corpo da requisição não é um JSON válido.");
  }
}

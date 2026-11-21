import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { AppError } from "@/lib/errors";
import { requireRoles } from "@/server/auth/permissions";
import { errorResponse, json } from "@/server/http";

export async function POST(request: Request) {
  try {
    await requireRoles(["ADMIN"]);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("Selecione uma imagem.");
    if (file.size > 2 * 1024 * 1024) throw new AppError("A imagem deve ter no máximo 2 MB.");
    const extensions: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
    };
    const extension = extensions[file.type];
    if (!extension) throw new AppError("Envie uma imagem PNG, JPG ou WEBP.");
    const filename = `${randomUUID()}.${extension}`;
    const directory = path.join(process.cwd(), "public", "uploads");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, filename), Buffer.from(await file.arrayBuffer()));
    return json({ url: `/uploads/${filename}` });
  } catch (error) {
    return errorResponse(error);
  }
}

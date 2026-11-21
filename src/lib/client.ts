export async function mutate<T>(url: string, options: RequestInit = {}): Promise<T> {
  const isForm = options.body instanceof FormData;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Não foi possível concluir a operação.");
  }
  return data as T;
}

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const apiFetch = async <T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> => {
  const headers = new Headers(options.headers ?? {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const message = payload.error ?? "Fehler beim Laden.";
    throw new Error(message);
  }
  return res.json();
};

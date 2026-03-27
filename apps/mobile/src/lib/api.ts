export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export const apiFetch = async <T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {})
    }
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const message = payload.error ?? "Fehler beim Laden.";
    throw new Error(message);
  }
  return res.json();
};

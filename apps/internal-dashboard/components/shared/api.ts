const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const apiFetch = async <T>(path: string, token: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("SESSION_EXPIRED");
    }
    const payload = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
};

export { API_URL };

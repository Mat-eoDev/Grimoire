const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

type ApiOptions = RequestInit & {
  json?: unknown;
};

export async function apiFetch<T>(path: string, options: ApiOptions = {}) {
  const headers = new Headers(options.headers);

  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as T | { error?: string };

  if (!response.ok) {
    throw new Error(
      typeof payload === "object" && payload && "error" in payload && payload.error
        ? String(payload.error)
        : "Une erreur est survenue"
    );
  }

  return payload as T;
}

export function buildEventUrl(campaignId: string) {
  return `${API_URL}/campaigns/${campaignId}/events`;
}


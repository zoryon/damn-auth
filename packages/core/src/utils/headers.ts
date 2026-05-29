import type { RequestLike } from "../types/index.js";

export function getHeader(headers: RequestLike["headers"], name: string): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(direct)) {
    return direct[0];
  }
  return direct;
}

export function getBearerToken(request: RequestLike): string | null {
  const auth = getHeader(request.headers, "authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return auth.slice("bearer ".length).trim();
}

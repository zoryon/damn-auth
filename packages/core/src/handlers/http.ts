import { AuthError } from "../errors/index.js";
import type { ResponseLike } from "../types/index.js";

export function json(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): ResponseLike {
  return {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...init.headers
    },
    body
  };
}

export function errorResponse(error: unknown): ResponseLike {
  if (error instanceof AuthError) {
    return json(error.toJSON(), { status: error.statusCode });
  }
  // Unknown errors keep a stable response shape without leaking implementation details.
  return json(
    {
      error: "InternalAuthError",
      message: error instanceof Error ? error.message : "Unexpected authentication error.",
      code: "INTERNAL_AUTH_ERROR",
      statusCode: 500
    },
    { status: 500 }
  );
}

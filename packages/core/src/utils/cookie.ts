import type { CookieOptions, RequestLike } from "../types/index.js";
import { getHeader } from "./headers.js";

export function parseCookies(request: RequestLike): Record<string, string> {
  const cookie = getHeader(request.headers, "cookie");
  if (!cookie) {
    return {};
  }

  return cookie.split(";").reduce<Record<string, string>>((acc, part) => {
    const [rawName, ...valueParts] = part.trim().split("=");
    if (!rawName) {
      return acc;
    }
    acc[decodeURIComponent(rawName)] = decodeURIComponent(valueParts.join("="));
    return acc;
  }, {});
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}) {
  const segments = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    segments.push(`Max-Age=${Math.floor(options.maxAge)}`);
  }
  if (options.domain) {
    segments.push(`Domain=${options.domain}`);
  }
  segments.push(`Path=${options.path ?? "/"}`);
  if (options.httpOnly ?? true) {
    segments.push("HttpOnly");
  }
  if (options.secure) {
    segments.push("Secure");
  }
  const sameSite = options.sameSite ?? "lax";
  segments.push(`SameSite=${sameSite[0]?.toUpperCase()}${sameSite.slice(1)}`);

  return segments.join("; ");
}

export function clearCookie(name: string, options: CookieOptions = {}) {
  return serializeCookie(name, "", { ...options, maxAge: 0 });
}

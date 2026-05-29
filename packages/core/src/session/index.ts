import { clearCookie, parseCookies, serializeCookie } from "../utils/cookie.js";
import { getBearerToken } from "../utils/headers.js";
import type { AuthSession, IssuedSession, RequestLike, ResolvedAuthConfig, ResponseLike, User } from "../types/index.js";
import { cacheUser, getUserById, invalidateCachedUser } from "../cache/index.js";
import { createSession, getSession, invalidateSession } from "./opaque.js";
import { createSessionJwt, revokeSessionJwt, verifySessionJwt } from "./jwt.js";
import { createRefreshToken, issueAccessToken, rotateRefreshToken } from "./refresh.js";

export { createRefreshToken, issueAccessToken, rotateRefreshToken } from "./refresh.js";
export { createSessionJwt, revokeSessionJwt, verifySessionJwt } from "./jwt.js";
export { createSession, getSession, invalidateSession } from "./opaque.js";

export async function issueSession(config: ResolvedAuthConfig, user: User): Promise<IssuedSession> {
  // Cache is helpful but never part of issuing a valid session.
  await cacheUser(config, user).catch(() => undefined);

  // JWT sessions keep the signed token in the auth cookie.
  if (config.session.strategy === "jwt") {
    const token = await createSessionJwt(config, user);
    return {
      user,
      accessToken: token,
      cookie: serializeCookie(config.session.cookieName, token, {
        ...config.session.cookieOptions,
        maxAge: config.session.retention
      })
    };
  }

  // Refresh sessions split a short access token from a longer lived cookie token.
  if (config.session.strategy === "refresh") {
    const accessToken = await issueAccessToken(config, user);
    const refreshToken = await createRefreshToken(config, user.id);
    return {
      user,
      accessToken,
      refreshToken,
      cookie: serializeCookie(config.session.refreshToken.cookieName, refreshToken.token, {
        ...config.session.cookieOptions,
        maxAge: config.session.refreshToken.expiresIn
      })
    };
  }

  // Opaque sessions store the token server-side and put only the lookup key in the cookie.
  const session = await createSession(config, user.id);
  return {
    user,
    session,
    cookie: serializeCookie(config.session.cookieName, session.token, {
      ...config.session.cookieOptions,
      maxAge: config.session.retention
    })
  };
}

export async function readSessionFromRequest(config: ResolvedAuthConfig, request: RequestLike): Promise<AuthSession | null> {
  const cookies = parseCookies(request);

  // Refresh mode authenticates normal requests with the bearer access token.
  if (config.session.strategy === "refresh") {
    const bearer = getBearerToken(request);
    if (!bearer) {
      return null;
    }
    return verifySessionJwt(config, bearer);
  }

  const token = cookies[config.session.cookieName];
  if (!token) {
    return null;
  }

  // Cookie-backed strategies share the same cookie name, then diverge by verification style.
  if (config.session.strategy === "jwt") {
    return verifySessionJwt(config, token);
  }

  return getSession(config, token);
}

export async function refreshSessionFromRequest(config: ResolvedAuthConfig, request: RequestLike): Promise<IssuedSession> {
  const cookies = parseCookies(request);
  const oldToken = cookies[config.session.refreshToken.cookieName];
  if (!oldToken) {
    throw new Error("Refresh cookie is missing.");
  }

  // Rotation narrows replay windows by replacing the refresh token on every refresh.
  const refreshToken = config.session.refreshToken.rotationEnabled
    ? await rotateRefreshToken(config, oldToken)
    : await config.adapter.getRefreshToken(oldToken);

  if (!refreshToken) {
    throw new Error("Refresh token is invalid.");
  }

  const user = await getUserById(config, refreshToken.userId);
  if (!user) {
    throw new Error("Refresh token user no longer exists.");
  }

  const accessToken = await issueAccessToken(config, user);
  return {
    user,
    accessToken,
    refreshToken,
    cookie: serializeCookie(config.session.refreshToken.cookieName, refreshToken.token, {
      ...config.session.cookieOptions,
      maxAge: config.session.refreshToken.expiresIn
    })
  };
}

export async function revokeSessionFromRequest(config: ResolvedAuthConfig, request: RequestLike): Promise<ResponseLike> {
  const cookies = parseCookies(request);
  const sessionToken = cookies[config.session.cookieName];
  const refreshToken = cookies[config.session.refreshToken.cookieName];

  // Invalidation also drops cached user data when the database token points to a user.
  if (config.session.strategy === "opaque" && sessionToken) {
    const current = await config.adapter.getSessionByToken(sessionToken).catch(() => null);
    await invalidateSession(config, sessionToken);
    if (current) {
      await invalidateCachedUser(config, current.userId).catch(() => undefined);
    }
  }
  if (config.session.strategy === "jwt" && sessionToken) {
    await revokeSessionJwt(config, sessionToken);
  }
  // Refresh logout revokes the long-lived credential and lets access tokens expire naturally.
  if (config.session.strategy === "refresh" && refreshToken) {
    const current = await config.adapter.getRefreshToken(refreshToken).catch(() => null);
    await config.adapter.revokeRefreshToken(refreshToken);
    if (current) {
      await invalidateCachedUser(config, current.userId).catch(() => undefined);
    }
  }

  const cookiesToClear = [
    clearCookie(config.session.cookieName, config.session.cookieOptions),
    clearCookie(config.session.refreshToken.cookieName, config.session.cookieOptions)
  ];

  return {
    status: 204,
    headers: {
      "set-cookie": cookiesToClear.join(", ")
    }
  };
}

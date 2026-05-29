import { generateToken } from "../crypto/index.js";
import type { ResolvedAuthConfig, User } from "../types/index.js";
import { isExpired, secondsFromNow } from "../utils/time.js";
import { SessionExpiredError, SessionNotFoundError } from "../errors/index.js";
import { createSessionJwt } from "./jwt.js";

export async function createRefreshToken(config: ResolvedAuthConfig, userId: string, familyId = generateToken(16)) {
  return config.adapter.createRefreshToken({
    userId,
    familyId,
    token: generateToken(32),
    expiresAt: secondsFromNow(config.session.refreshToken.expiresIn)
  });
}

export async function rotateRefreshToken(config: ResolvedAuthConfig, oldToken: string) {
  const current = await config.adapter.getRefreshToken(oldToken);
  if (!current || current.revokedAt) {
    throw new SessionNotFoundError("Refresh token was not found or has been revoked.");
  }
  if (isExpired(current.expiresAt)) {
    throw new SessionExpiredError("Refresh token has expired.");
  }

  // The family id ties rotations together without reusing the previous token value.
  return config.adapter.rotateRefreshToken(oldToken, {
    userId: current.userId,
    familyId: current.familyId,
    token: generateToken(32),
    expiresAt: secondsFromNow(config.session.refreshToken.expiresIn)
  });
}

export async function issueAccessToken(config: ResolvedAuthConfig, user: User) {
  return createSessionJwt(config, user, config.session.accessToken.expiresIn);
}

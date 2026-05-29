import type { JWTPayload } from "jose";
import { TokenRevokedError } from "../errors/index.js";
import { generateToken, signJwt, verifyJwt } from "../crypto/index.js";
import type { AuthSession, ResolvedAuthConfig, User } from "../types/index.js";
import { secondsFromNow } from "../utils/time.js";
import { getUserById } from "../cache/index.js";

export interface SessionJwtClaims extends JWTPayload {
  sub: string;
  email: string;
  role?: string | null;
  name?: string | null;
}

export async function createSessionJwt(config: ResolvedAuthConfig, user: User, expiresIn = config.session.retention) {
  const jti = generateToken(16);
  return signJwt(
    {
      email: user.email,
      role: user.role ?? config.roles.defaultRole,
      name: user.name ?? null
    },
    config.crypto,
    {
      subject: user.id,
      expiresIn,
      jti
    }
  );
}

export async function verifySessionJwt(config: ResolvedAuthConfig, token: string): Promise<AuthSession> {
  const claims = await verifyJwt<SessionJwtClaims>(token, config.crypto);
  // Revocation is optional so adapters without a revocation table can still use JWT sessions.
  if (claims.jti && config.adapter.getTokenRevocation) {
    const revoked = await config.adapter.getTokenRevocation(claims.jti);
    if (revoked) {
      throw new TokenRevokedError();
    }
  }

  // A valid signature is not enough if the user has been deleted or hidden by the adapter.
  const user = await getUserById(config, claims.sub);
  if (!user) {
    throw new TokenRevokedError("The token references a user that no longer exists.");
  }

  return { user, accessToken: token, claims };
}

export async function revokeSessionJwt(config: ResolvedAuthConfig, token: string) {
  if (!config.adapter.createTokenRevocation) {
    return;
  }
  const claims = await verifyJwt<SessionJwtClaims>(token, config.crypto);
  if (!claims.jti) {
    return;
  }
  // Keep the revocation row only as long as the original token could have been accepted.
  await config.adapter.createTokenRevocation({
    userId: claims.sub,
    jti: claims.jti,
    expiresAt: claims.exp ? new Date(claims.exp * 1000) : secondsFromNow(config.session.retention)
  });
}

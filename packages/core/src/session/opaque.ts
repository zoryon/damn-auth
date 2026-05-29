import { SessionExpiredError } from "../errors/index.js";
import type { ResolvedAuthConfig, Session, User } from "../types/index.js";
import { generateToken } from "../crypto/index.js";
import { isExpired, secondsFromNow } from "../utils/time.js";
import { getUserById } from "../cache/index.js";

export async function createSession(config: ResolvedAuthConfig, userId: string): Promise<Session> {
  return config.adapter.createSession({
    userId,
    token: generateToken(32),
    expiresAt: secondsFromNow(config.session.retention)
  });
}

export async function getSession(config: ResolvedAuthConfig, token: string) {
  const session = await config.adapter.getSessionByToken(token);
  if (!session) {
    return null;
  }
  if (isExpired(session.expiresAt)) {
    // Remove stale rows as they are found so repeated reads do not keep hitting them.
    await config.adapter.deleteSession(token).catch(() => undefined);
    throw new SessionExpiredError();
  }

  // Some adapters hydrate the user with the session; otherwise the cache/database path fills it in.
  const user: User | null = session.user ?? (await getUserById(config, session.userId));
  if (!user) {
    return null;
  }

  return { user, session };
}

export async function invalidateSession(config: ResolvedAuthConfig, token: string) {
  await config.adapter.deleteSession(token);
}

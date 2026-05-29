import { createLogger } from "@damn-auth/logger";
import { AuthConfigError, AuthCredentialsError, SessionNotFoundError } from "../errors/index.js";
import { issueSession, readSessionFromRequest, revokeSessionFromRequest } from "../session/index.js";
import { verifyPassword, hashPassword } from "../crypto/index.js";
import { cacheUser } from "../cache/index.js";
import type { AuthConfig, AuthInstance, AuthSession, DatabaseAdapter, RequestLike, ResolvedAuthConfig, RoleMode, User } from "../types/index.js";
import { authConfigSchema } from "./schema.js";
import { defaultConfig } from "./defaults.js";

const requiredAdapterMethods: Array<keyof DatabaseAdapter> = [
  "createUser",
  "getUserById",
  "getUserByEmail",
  "updateUser",
  "deleteUser",
  "linkAccount",
  "getAccountByProvider",
  "unlinkAccount",
  "createSession",
  "getSessionByToken",
  "updateSession",
  "deleteSession",
  "deleteExpiredSessions",
  "createRefreshToken",
  "getRefreshToken",
  "rotateRefreshToken",
  "revokeRefreshToken",
  "revokeAllRefreshTokensForUser",
  "createVerificationToken",
  "getVerificationToken",
  "deleteVerificationToken"
];

function validateAdapter(adapter: unknown): asserts adapter is DatabaseAdapter {
  if (!adapter || typeof adapter !== "object") {
    throw new AuthConfigError("A database adapter is required.");
  }

  // Fail early with a concrete method name instead of surfacing a late runtime error.
  for (const method of requiredAdapterMethods) {
    if (typeof (adapter as Record<string, unknown>)[method] !== "function") {
      throw new AuthConfigError(`Database adapter is missing required method: ${method}`);
    }
  }
}

function resolveConfig(config: AuthConfig): ResolvedAuthConfig {
  const parsed = authConfigSchema.safeParse(config);
  if (!parsed.success) {
    throw new AuthConfigError("Invalid auth configuration.", parsed.error);
  }

  validateAdapter(config.adapter);

  // Merge nested defaults explicitly so partial config objects do not drop inner defaults.
  const session = {
    ...defaultConfig.session,
    ...config.session,
    cookieOptions: {
      ...defaultConfig.session.cookieOptions,
      ...config.session?.cookieOptions
    },
    accessToken: {
      ...defaultConfig.session.accessToken,
      ...config.session?.accessToken
    },
    refreshToken: {
      ...defaultConfig.session.refreshToken,
      ...config.session?.refreshToken
    }
  };

  const crypto = {
    algorithm: "HS256" as const,
    keyLength: 2048 as const,
    passwordHashAlgo: "bcrypt" as const,
    bcryptRounds: 12,
    ...config.crypto
  };

  // HMAC needs a shared secret; asymmetric algorithms need a key pair.
  if (crypto.algorithm.startsWith("HS") && !crypto.secret) {
    throw new AuthConfigError("crypto.secret is required for HMAC JWT algorithms.");
  }
  if (!crypto.algorithm.startsWith("HS") && (!crypto.privateKey || !crypto.publicKey)) {
    throw new AuthConfigError("crypto.privateKey and crypto.publicKey are required for asymmetric JWT algorithms.");
  }

  const roles = {
    ...defaultConfig.roles,
    ...config.roles
  };

  const cache = {
    ...defaultConfig.cache,
    ...config.cache,
    user: {
      ...defaultConfig.cache.user,
      ...config.cache?.user
    }
  };

  if (cache.enabled && !cache.adapter) {
    throw new AuthConfigError("cache.adapter is required when cache.enabled is true.");
  }

  if (!roles.hierarchy.includes(roles.defaultRole)) {
    throw new AuthConfigError("roles.defaultRole must be present in roles.hierarchy.");
  }

  // Production cookies must be secure unless the app makes an explicit unsafe choice.
  if (
    process.env.NODE_ENV === "production" &&
    !session.cookieOptions.secure &&
    !config.allowInsecureCookiesInProduction
  ) {
    throw new AuthConfigError("Secure cookies are required in production unless allowInsecureCookiesInProduction is true.");
  }

  return {
    adapter: config.adapter,
    session,
    crypto,
    providers: config.providers ?? [],
    roles,
    cache,
    urls: {
      ...defaultConfig.urls,
      ...config.urls
    },
    logger: {
      ...defaultConfig.logger,
      ...config.logger
    },
    allowInsecureCookiesInProduction: config.allowInsecureCookiesInProduction ?? false
  };
}

function hasRole(config: ResolvedAuthConfig, target: User | AuthSession | null, role: string, mode: RoleMode = "exact") {
  if (!target) {
    return false;
  }

  const user = "user" in target ? target.user : target;
  const actual = user.role ?? config.roles.defaultRole;

  if (!config.roles.enabled) {
    return true;
  }
  if (mode === "exact") {
    return actual === role;
  }

  // In minimum mode, later entries in the hierarchy include every role before them.
  const actualIndex = config.roles.hierarchy.indexOf(actual);
  const requiredIndex = config.roles.hierarchy.indexOf(role);
  return actualIndex >= 0 && requiredIndex >= 0 && actualIndex >= requiredIndex;
}

export function initAuth(config: AuthConfig): AuthInstance {
  const resolved = resolveConfig(config);
  const logger = createLogger(resolved.logger);

  return {
    config: resolved,
    async getSession(request: RequestLike) {
      return readSessionFromRequest(resolved, request);
    },
    async requireSession(request: RequestLike) {
      const session = await readSessionFromRequest(resolved, request);
      if (!session) {
        throw new SessionNotFoundError();
      }
      return session;
    },
    async signInWithCredentials(email: string, password: string) {
      const user = await resolved.adapter.getUserByEmail(email.toLowerCase());
      if (!user?.passwordHash) {
        throw new AuthCredentialsError();
      }
      const valid = await verifyPassword(password, user.passwordHash, resolved.crypto.passwordHashAlgo);
      if (!valid) {
        throw new AuthCredentialsError();
      }
      const issued = await issueSession(resolved, user);
      logger.info("session.created", { userId: user.id, strategy: resolved.session.strategy });
      return issued;
    },
    async signUpWithCredentials(input) {
      const existing = await resolved.adapter.getUserByEmail(input.email.toLowerCase());
      if (existing) {
        throw new AuthCredentialsError("A user with this email already exists.");
      }
      const user = await resolved.adapter.createUser({
        email: input.email.toLowerCase(),
        name: input.name,
        role: resolved.roles.defaultRole,
        passwordHash: await hashPassword(input.password, resolved.crypto.passwordHashAlgo, {
          bcryptRounds: resolved.crypto.bcryptRounds
        })
      });
      await cacheUser(resolved, user).catch(() => undefined);
      logger.info("user.created", { userId: user.id });
      return user;
    },
    async signOut(request: RequestLike) {
      return revokeSessionFromRequest(resolved, request);
    },
    hasRole: (target, role, mode) => hasRole(resolved, target, role, mode),
    log(event) {
      logger.emit(event);
    }
  };
}

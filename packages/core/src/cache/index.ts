import { createHash } from "node:crypto";
import type { ResolvedAuthConfig, User } from "../types/index.js";

interface CachedUser {
  id: string;
  email: string;
  name?: string | null | undefined;
  image?: string | null | undefined;
  emailVerified?: string | null | undefined;
  role?: string | null | undefined;
  createdAt: string;
  updatedAt: string;
}

function cacheEnabled(config: ResolvedAuthConfig) {
  return Boolean(config.cache.enabled && config.cache.adapter);
}

function hashKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function cacheKey(config: ResolvedAuthConfig, parts: string[]) {
  return [config.cache.prefix, ...parts].join(":");
}

export function hashedCacheKey(config: ResolvedAuthConfig, type: string, value: string) {
  return cacheKey(config, [type, hashKey(value)]);
}

function toCachedUser(user: User): CachedUser {
  // Cache only the public profile; credentials and tokens must stay in the database.
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    emailVerified: user.emailVerified?.toISOString() ?? null,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

function fromCachedUser(user: CachedUser): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    passwordHash: null,
    emailVerified: user.emailVerified ? new Date(user.emailVerified) : null,
    role: user.role,
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt)
  };
}

export async function cacheUser(config: ResolvedAuthConfig, user: User) {
  if (!cacheEnabled(config) || !config.cache.user.enabled || !config.cache.adapter) {
    return;
  }

  await config.cache.adapter.set(
    cacheKey(config, ["user", user.id]),
    JSON.stringify(toCachedUser(user)),
    config.cache.user.ttl
  );
}

export async function getCachedUser(config: ResolvedAuthConfig, userId: string) {
  if (!cacheEnabled(config) || !config.cache.user.enabled || !config.cache.adapter) {
    return null;
  }

  const raw = await config.cache.adapter.get(cacheKey(config, ["user", userId]));
  if (!raw) {
    return null;
  }

  try {
    return fromCachedUser(JSON.parse(raw) as CachedUser);
  } catch {
    // Bad cache entries should self-heal instead of breaking authentication.
    await config.cache.adapter.delete(cacheKey(config, ["user", userId])).catch(() => undefined);
    return null;
  }
}

export async function getUserById(config: ResolvedAuthConfig, userId: string) {
  const cached = await getCachedUser(config, userId);
  if (cached) {
    return cached;
  }

  const user = await config.adapter.getUserById(userId);
  if (user) {
    // Cache population is best-effort so Redis hiccups do not make login fail.
    await cacheUser(config, user).catch(() => undefined);
  }
  return user;
}

export async function invalidateCachedUser(config: ResolvedAuthConfig, userId: string) {
  if (!cacheEnabled(config) || !config.cache.adapter) {
    return;
  }

  await config.cache.adapter.delete(cacheKey(config, ["user", userId]));
}

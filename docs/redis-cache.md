# Redis Cache

Damn Auth can use Redis as an optional cache.

Redis does not replace the main database. The database remains the source of truth for users, OAuth accounts, sessions, refresh tokens, verification tokens, and revocations.

## Security Rule

Only data that you could reasonably return to the client should end up in Redis.

Damn Auth does not store the following in Redis:

- password hash
- plaintext passwords
- refresh token
- access token
- plaintext session tokens
- OAuth access token
- OAuth refresh token
- verification token
- CSRF token
- secrets or private keys

The built-in cache stores only a public version of the user:

```ts
{
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: string | null;
  role?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

`passwordHash` is excluded.

## Installation

With `node-redis`:

```bash
pnpm add @damn-auth/cache-redis redis
```

With `ioredis`:

```bash
pnpm add @damn-auth/cache-redis ioredis
```

## Use with node-redis

```ts
import { createClient } from "redis";
import { RedisCache } from "@damn-auth/cache-redis";

export const redis = createClient({
  url: process.env.REDIS_URL
});

await redis.connect();

export const cache = RedisCache(redis);
```

## Use with ioredis

```ts
import Redis from "ioredis";
import { RedisCache } from "@damn-auth/cache-redis";

export const redis = new Redis(process.env.REDIS_URL);
export const cache = RedisCache(redis);
```

## Auth Configuration

```ts
import { initAuth } from "@damn-auth/core";
import { PgAdapter } from "@damn-auth/adapter-pg";
import { RedisCache } from "@damn-auth/cache-redis";
import { pool } from "./db";
import { redis } from "./redis";

export const auth = initAuth({
  adapter: PgAdapter(pool),
  cache: {
    enabled: true,
    adapter: RedisCache(redis),
    prefix: "my-app-auth",
    ttl: 300,
    user: {
      enabled: true,
      ttl: 300
    }
  },
  session: {
    strategy: "opaque"
  },
  crypto: {
    algorithm: "HS256",
    secret: process.env.AUTH_SECRET
  }
});
```

## How It Works by Session Strategy

### opaque

With `opaque`, the session token is server-side.

For security, Damn Auth keeps reading the session from the database:

1. reads the `__auth_session` cookie
2. looks up the session in the database
3. checks expiration and revocation
4. uses Redis only to cache the public user profile

This means Redis reduces queries on the users table, but does not eliminate the query on the sessions table.

This is intentional: if the opaque session were cached as the primary source, immediate revocation would become less reliable.

### jwt

With `jwt`, the token is verified cryptographically.

Damn Auth:

1. verifies the JWT signature and expiration
2. checks any revocation through the adapter, if configured
3. loads the user from Redis if present
4. on cache miss, reads the user from the database and updates Redis

Redis does not store the JWT.

### refresh

With `refresh`, Redis does not store refresh tokens or access tokens.

Damn Auth:

1. verifies the access token on normal requests
2. uses Redis only to cache the public user profile
3. when the client calls `/auth/refresh`, the refresh token is always checked through the adapter/database

This keeps refresh token revocation reliable.

## Invalidation

Damn Auth invalidates the user cache when:

- a user is created
- a session is issued
- logout happens from an `opaque` session
- a refresh token is revoked during `refresh` logout

If your app directly changes a user's role, email, name, or image outside Damn Auth, you must invalidate the cache or use short TTLs.

For a simple cache, keep `ttl` low:

```ts
cache: {
  enabled: true,
  adapter: RedisCache(redis),
  user: {
    enabled: true,
    ttl: 60
  }
}
```

## Redis Keys

Default:

```txt
damn-auth:user:<userId>
```

You can change the prefix:

```ts
cache: {
  enabled: true,
  adapter: RedisCache(redis),
  prefix: "production-auth"
}
```

Result:

```txt
production-auth:user:<userId>
```

## When to Use It

Redis is useful if:

- you have many authenticated routes
- you use `jwt` but want to avoid repeated user lookups
- you want to reduce frequent queries on the users table
- you have roles or profiles that are read often

Redis is less useful if:

- you have very little traffic
- you only use `opaque` and the bottleneck is the sessions table
- you want instant revocation and long cache TTLs

## Production Checklist

- Do not use Redis as the only auth storage.
- Do not store tokens or passwords in Redis.
- Use short TTLs if roles and permissions change often.
- Use one prefix per environment, for example `prod-auth` or `staging-auth`.
- Protect Redis with a private network, ACLs, and TLS if available.
- Monitor cache hits/misses and memory.

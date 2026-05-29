# Damn Auth Usage Guide

This guide explains how to use Damn Auth in a real Node.js app.

The examples use PostgreSQL with `@damn-auth/adapter-pg`, but the core works the same way with the other adapters.

## Installation

Install the core and one database adapter:

```bash
pnpm add @damn-auth/core @damn-auth/adapter-pg pg
```

If you use React:

```bash
pnpm add @damn-auth/react
```

## Environment Variables

Create a `.env` file in your app:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/my_app"
AUTH_SECRET="change-this-with-a-long-random-secret"
NODE_ENV="development"
```

`AUTH_SECRET` must be a long, private string. In production it must never be hardcoded.

## Create the DB Connection

Example `src/db.ts`:

```ts
import pg from "pg";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});
```

The pool remains owned by your application. Damn Auth does not open connections on its own.

## Apply the Schema

Damn Auth does not create tables automatically in production.

In development you can use:

```ts
import { PgAdapter } from "@damn-auth/adapter-pg";
import { pool } from "./db";

const adapter = PgAdapter(pool);

await adapter.migrate();
```

In production, use an explicit migration. See [PostgreSQL Adapter](postgresql-adapter.md).

## Configure Auth

Example `src/auth.ts`:

```ts
import { initAuth } from "@damn-auth/core";
import { PgAdapter } from "@damn-auth/adapter-pg";
import { pool } from "./db";

export const auth = initAuth({
  adapter: PgAdapter(pool),
  session: {
    strategy: "opaque",
    retention: 60 * 60 * 24 * 7
  },
  crypto: {
    algorithm: "HS256",
    secret: process.env.AUTH_SECRET
  },
  providers: [],
  roles: {
    enabled: true,
    defaultRole: "user",
    hierarchy: ["guest", "user", "admin"]
  },
  logger: {
    level: "info",
    format: "pretty"
  }
});
```

## Session Strategies

`opaque`:

- stores the session token in the database
- puts the token in an `httpOnly` cookie
- allows immediate revocation
- requires a DB query for every authenticated request

`jwt`:

- stores a signed JWT in the cookie
- verifies without DB queries in most cases
- immediate revocation requires the token revocation table

`refresh`:

- uses a short-lived access token and a long-lived refresh token
- the refresh token stays in an `httpOnly` cookie
- the access token is returned to the client
- requires more client-side integration

To start, use `opaque`.

## Optional Redis Cache

Damn Auth can use Redis as a cache, but not as the auth database.

Install:

```bash
pnpm add @damn-auth/cache-redis redis
```

Configure:

```ts
import { createClient } from "redis";
import { RedisCache } from "@damn-auth/cache-redis";

const redis = createClient({
  url: process.env.REDIS_URL
});

await redis.connect();

export const auth = initAuth({
  adapter: PgAdapter(pool),
  cache: {
    enabled: true,
    adapter: RedisCache(redis),
    prefix: "my-app-auth",
    user: {
      enabled: true,
      ttl: 300
    }
  },
  crypto: {
    algorithm: "HS256",
    secret: process.env.AUTH_SECRET
  }
});
```

Redis stores only a cache of the public user: id, email, name, image, role, and dates.

It does not store password hashes, refresh tokens, access tokens, session tokens, OAuth tokens, verification tokens, or secrets.

Behavior by strategy:

- `opaque`: the session is still verified against the DB; Redis caches only the public user.
- `jwt`: the JWT is verified normally; Redis can avoid repeated user lookups.
- `refresh`: refresh tokens and access tokens do not go into Redis; Redis caches only the public user.

Full details: [Redis Cache](redis-cache.md).

## Route Express

Minimal `src/server.ts` example:

```ts
import express from "express";
import {
  requireAuth,
  sessionHandler,
  signInHandler,
  signOutHandler,
  signUpHandler
} from "@damn-auth/core";
import { auth } from "./auth";

const app = express();

app.use(express.json());

app.post("/auth/signup", async (req, res, next) => {
  try {
    const response = await signUpHandler(auth, {
      headers: req.headers,
      body: req.body
    });

    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
});

app.post("/auth/signin", async (req, res, next) => {
  try {
    const response = await signInHandler(auth, {
      headers: req.headers,
      body: req.body
    });

    res.set(response.headers).status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
});

app.get("/auth/session", async (req, res, next) => {
  try {
    const response = await sessionHandler(auth, {
      headers: req.headers
    });

    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
});

app.post("/auth/signout", async (req, res, next) => {
  try {
    const response = await signOutHandler(auth, {
      headers: req.headers
    });

    res.set(response.headers).sendStatus(response.status);
  } catch (error) {
    next(error);
  }
});

app.get("/private", requireAuth(auth, { mode: "api" }), (_req, res) => {
  res.json({ ok: true });
});

app.listen(3000);
```

## Signup

Request:

```http
POST /auth/signup
Content-Type: application/json

{
  "email": "ada@example.com",
  "password": "correct horse battery staple",
  "name": "Ada"
}
```

Effect:

- normalizes the email to lowercase
- hashes the password
- creates the user in the database
- assigns `roles.defaultRole`

Signup does not automatically create a session. After registration, you can call signin.

## Signin

Request:

```http
POST /auth/signin
Content-Type: application/json

{
  "email": "ada@example.com",
  "password": "correct horse battery staple"
}
```

Response:

- sets the session cookie
- returns `user`
- returns `accessToken` only if the strategy provides one

## Read the Session

Request:

```http
GET /auth/session
Cookie: __auth_session=...
```

Response:

```json
{
  "session": {
    "user": {
      "id": "...",
      "email": "ada@example.com",
      "role": "user"
    }
  }
}
```

If there is no valid session:

```json
{
  "session": null
}
```

## Logout

Request:

```http
POST /auth/signout
Cookie: __auth_session=...
```

Effect:

- `opaque`: deletes the session from the database
- `jwt`: adds the `jti` to the revocation list if supported
- `refresh`: revokes the refresh token
- clears auth cookies

## Protect Routes

Authenticated route:

```ts
app.get("/dashboard", requireAuth(auth, { mode: "api" }), handler);
```

Route with role:

```ts
import { requireRole } from "@damn-auth/core";

app.delete(
  "/admin/users/:id",
  requireRole(auth, "admin", { responseMode: "api" }),
  deleteUserHandler
);
```

Manual role check:

```ts
const session = await auth.requireSession({ headers: req.headers });

if (!auth.hasRole(session, "admin")) {
  throw new Error("Forbidden");
}
```

## React

Wrap the app:

```tsx
import { AuthProvider } from "@damn-auth/react";

export function App() {
  return (
    <AuthProvider sessionUrl="/auth/session">
      <Routes />
    </AuthProvider>
  );
}
```

Use auth state:

```tsx
import { useAuth } from "@damn-auth/react";

export function Header() {
  const { user, status, signOut } = useAuth();

  if (status === "loading") return null;
  if (!user) return <a href="/login">Login</a>;

  return (
    <button onClick={() => void signOut()}>
      Logout {user.email}
    </button>
  );
}
```

Protected route:

```tsx
import { ProtectedRoute } from "@damn-auth/react";

export function AdminPage() {
  return (
    <ProtectedRoute requiredRole="admin" fallback={<LoginPage />}>
      <AdminDashboard />
    </ProtectedRoute>
  );
}
```

Headless login form:

```tsx
import { LoginForm } from "@damn-auth/react";

export function LoginPage() {
  return (
    <LoginForm
      providers={["google", "github"]}
      showCredentials
      onSuccess={() => window.location.assign("/")}
    />
  );
}
```

## Cookie

Default:

```ts
cookieName: "__auth_session"
cookieOptions: {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/"
}
```

In production, `secure` must be `true` unless explicitly overridden.

## Errors

Handlers return errors in this format:

```json
{
  "error": "TokenInvalidError",
  "message": "The token is invalid.",
  "code": "TOKEN_INVALID",
  "statusCode": 401
}
```

Common errors:

- `AUTH_CONFIG_ERROR`: invalid configuration
- `INVALID_CREDENTIALS`: wrong email/password
- `SESSION_NOT_FOUND`: missing session
- `SESSION_EXPIRED`: expired session
- `INSUFFICIENT_ROLE`: insufficient role

## Production Checklist

- Use `NODE_ENV=production`.
- Use a long, random, secret `AUTH_SECRET`.
- Apply the auth schema with a controlled migration.
- Do not call `adapter.migrate()` automatically in production.
- Use HTTPS so `secure` cookies work.
- Configure session retention consistently with your product.
- Log auth events, but do not log passwords or tokens.

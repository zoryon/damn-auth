# PostgreSQL Adapter

`@damn-auth/adapter-pg` connects Damn Auth to PostgreSQL using the Node `pg` driver.

The name `pg` is just the abbreviation used by the Node ecosystem for PostgreSQL.

## Installation

```bash
pnpm add @damn-auth/core @damn-auth/adapter-pg pg
```

TypeScript types for `pg`, if your app wants them:

```bash
pnpm add -D @types/pg
```

## What the Adapter Does

The adapter translates core operations into PostgreSQL queries.

Examples:

- `createUser()` becomes `INSERT INTO auth_users ...`
- `getUserByEmail()` becomes `SELECT * FROM auth_users WHERE email = $1`
- `createSession()` creates a row in `auth_sessions`
- `deleteSession()` deletes the session on logout
- `createRefreshToken()` stores a refresh token
- `createVerificationToken()` stores password reset, email verification, or CSRF tokens

The core does not know PostgreSQL directly. The core only talks to the `DatabaseAdapter` interface.

## What It Does Not Do

The PostgreSQL adapter does not do:

- database introspection
- schema pulls from the database
- automatic schema pushes
- automatic migrations in production
- PostgreSQL connection management

You create the connection with `pg.Pool`.

You apply the schema with a migration, or explicitly call `adapter.migrate()` in development.

## Basic Setup

`src/db.ts`:

```ts
import pg from "pg";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});
```

`src/auth.ts`:

```ts
import { initAuth } from "@damn-auth/core";
import { PgAdapter } from "@damn-auth/adapter-pg";
import { pool } from "./db";

export const auth = initAuth({
  adapter: PgAdapter(pool),
  session: {
    strategy: "opaque"
  },
  crypto: {
    algorithm: "HS256",
    secret: process.env.AUTH_SECRET
  }
});
```

## Required Schema

The adapter uses these tables:

- `auth_users`
- `auth_accounts`
- `auth_sessions`
- `auth_refresh_tokens`
- `auth_verification_tokens`
- `auth_token_revocations`

## Creating Tables in Development

You can call `migrate()`:

```ts
import { PgAdapter } from "@damn-auth/adapter-pg";
import { pool } from "./db";

const adapter = PgAdapter(pool);

await adapter.migrate();
```

This runs the schema exported by `pgSchema()` with `CREATE TABLE IF NOT EXISTS`.

It is convenient locally, in tests, and for prototypes. In production, use explicit migrations.

## Explicit SQL Migration

You can get the SQL like this:

```ts
import { pgSchema } from "@damn-auth/adapter-pg";

console.log(pgSchema());
```

Or create a script:

```ts
import { writeFileSync } from "node:fs";
import { pgSchema } from "@damn-auth/adapter-pg";

writeFileSync("migrations/001_create_auth_tables.sql", pgSchema());
```

Then apply the file with your tool:

```bash
psql "$DATABASE_URL" -f migrations/001_create_auth_tables.sql
```

Or copy the same SQL into:

- Supabase SQL editor
- Neon console
- Railway PostgreSQL console
- Render PostgreSQL console
- `node-pg-migrate`
- `knex`
- `drizzle`
- internal CI/CD pipeline

## Table Name Options

You can add a prefix:

```ts
const adapter = PgAdapter(pool, {
  tablePrefix: "myapp_"
});
```

With this config, the tables become:

- `myapp_auth_users`
- `myapp_auth_accounts`
- `myapp_auth_sessions`
- `myapp_auth_refresh_tokens`
- `myapp_auth_verification_tokens`
- `myapp_auth_token_revocations`

You can also rename specific tables:

```ts
const adapter = PgAdapter(pool, {
  tableNames: {
    users: "identity_users",
    sessions: "identity_sessions"
  }
});
```

Important: if you change names in `PgAdapter`, you must use the same config when generating the schema:

```ts
const options = {
  tableNames: {
    users: "identity_users",
    sessions: "identity_sessions"
  }
};

const adapter = PgAdapter(pool, options);
const sql = pgSchema(options);
```

## Migration Example with node-pg-migrate

```ts
import { pgSchema } from "@damn-auth/adapter-pg";

export async function up(pgm: { sql(query: string): void }) {
  pgm.sql(pgSchema());
}

export async function down(pgm: { sql(query: string): void }) {
  pgm.sql(`
    DROP TABLE IF EXISTS auth_token_revocations;
    DROP TABLE IF EXISTS auth_verification_tokens;
    DROP TABLE IF EXISTS auth_refresh_tokens;
    DROP TABLE IF EXISTS auth_sessions;
    DROP TABLE IF EXISTS auth_accounts;
    DROP TABLE IF EXISTS auth_users;
  `);
}
```

## Complete Express Example

```ts
import express from "express";
import pg from "pg";
import {
  initAuth,
  requireAuth,
  sessionHandler,
  signInHandler,
  signOutHandler,
  signUpHandler
} from "@damn-auth/core";
import { PgAdapter } from "@damn-auth/adapter-pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

const adapter = PgAdapter(pool);

if (process.env.AUTH_RUN_MIGRATIONS === "true") {
  await adapter.migrate();
}

const auth = initAuth({
  adapter,
  session: {
    strategy: "opaque"
  },
  crypto: {
    algorithm: "HS256",
    secret: process.env.AUTH_SECRET
  }
});

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

## Manual Test with curl

Registration:

```bash
curl -i \
  -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"ada@example.com\",\"password\":\"correct horse battery staple\",\"name\":\"Ada\"}"
```

Login:

```bash
curl -i \
  -X POST http://localhost:3000/auth/signin \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"ada@example.com\",\"password\":\"correct horse battery staple\"}"
```

Copy the `Set-Cookie` cookie and use it to read the session:

```bash
curl -i \
  http://localhost:3000/auth/session \
  -H "Cookie: __auth_session=PASTE_TOKEN_HERE"
```

## pgcrypto Extension

The schema uses:

```sql
gen_random_uuid()
```

On modern PostgreSQL it is normally available. If your database does not expose it, enable `pgcrypto`:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

You can add this line before the schema in your migration.

## Production

Recommendations:

- Do not call `adapter.migrate()` automatically on startup.
- Version the SQL in a migration.
- Use pooled connections with limits that fit your hosting.
- Use HTTPS.
- Keep `AUTH_SECRET` out of the code.
- If you use `jwt` with revocation, keep the `auth_token_revocations` table.

## Troubleshooting

`relation "auth_users" does not exist`:

- The schema has not been applied.
- You are using different `tablePrefix` or `tableNames` values between migration and adapter.

`function gen_random_uuid() does not exist`:

- Add `CREATE EXTENSION IF NOT EXISTS pgcrypto;`.

`password authentication failed`:

- `DATABASE_URL` is not correct.
- User, password, host, or database are wrong.

Login succeeds but `/auth/session` returns `null`:

- The client is not sending the cookie.
- In production, HTTPS is missing and the `secure` cookie is not saved.
- The cookie domain/path does not match the route.

`AUTH_CONFIG_ERROR`:

- `AUTH_SECRET` is missing.
- In production, cookies are not secure.
- The adapter passed to `initAuth()` does not implement all required methods.

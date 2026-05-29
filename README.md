# Damn Auth

Damn Auth is a database-agnostic TypeScript authentication toolkit for Node.js apps.

It is designed as a pnpm monorepo with independently installable packages:

- `@damn-auth/core`: configuration, crypto, sessions, OAuth helpers, handlers, middleware.
- `@damn-auth/react`: React context, hooks, protected routes, headless forms.
- `@damn-auth/logger`: structured logging with pluggable transports.
- `@damn-auth/cache-redis`: optional Redis cache for public auth/session data.
- `@damn-auth/adapter-*`: persistence adapters for Prisma, PostgreSQL, MySQL, Mongoose, and SQLite.

## Database Policy

Damn Auth never mutates a production database implicitly.

Adapters export schema snippets or migration SQL. The application owner applies them explicitly using their migration tool, or calls an explicit development helper such as `adapter.migrate()` when an adapter supports it.

Built-in SQL adapters support `tablePrefix` and `tableNames` options. Prisma users can use Prisma's `@@map` and `@map`. Custom schemas are supported by writing a custom `DatabaseAdapter`, but the auth contract still needs users, accounts, sessions, refresh tokens, verification tokens, and token revocations if JWT revocation is enabled.

## Quick Start

```ts
import { initAuth } from "@damn-auth/core";
import { PgAdapter } from "@damn-auth/adapter-pg";
import { pool } from "./db";

export const auth = initAuth({
  adapter: PgAdapter(pool),
  session: { strategy: "opaque" },
  crypto: {
    algorithm: "HS256",
    secret: process.env.AUTH_SECRET
  },
  providers: [],
  roles: {
    enabled: true,
    defaultRole: "user",
    hierarchy: ["guest", "user", "admin"]
  }
});
```

## Documentation

- [Usage Guide](docs/usage.md): complete setup, configuration, auth routes, and React.
- [Redis Cache](docs/redis-cache.md): optional Redis cache without using it as the auth database.
- [PostgreSQL Adapter](docs/postgresql-adapter.md): using `@damn-auth/adapter-pg`, schema, migrations, and table options.
- [Database Integration](docs/database.md): general rules for adapters and schema management.
- [Quick Start](docs/quick-start.md): minimal example.

See `apps/example-express` for a complete Express integration.

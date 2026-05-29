# Quick Start

```ts
import { initAuth } from "@damn-auth/core";
import { PgAdapter } from "@damn-auth/adapter-pg";

export const auth = initAuth({
  adapter: PgAdapter(pool),
  session: {
    strategy: "opaque"
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
  }
});
```

For development only, an adapter may expose:

```ts
await adapter.migrate();
```

In production, put the exported schema in your normal migration pipeline.

For the complete flow, read [Usage Guide](usage.md) and [PostgreSQL Adapter](postgresql-adapter.md).

For optional Redis caching, read [Redis Cache](redis-cache.md).

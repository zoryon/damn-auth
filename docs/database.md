# Database Integration

Damn Auth is database-agnostic, but it is not schema-less. The adapter contract needs a small set of auth entities:

- users
- OAuth accounts
- sessions
- refresh tokens
- verification tokens
- token revocations when JWT revocation is used

## Does Damn Auth Create Tables Automatically?

No hidden production mutations happen.

Each adapter exports a schema or migration string. SQL adapters also expose a `migrate()` helper, but it only runs when the application calls it explicitly.

Recommended production flow:

1. Import the schema/migration from the adapter package.
2. Copy it into your migration tool or Prisma schema.
3. Review table names, indexes, and constraints.
4. Run the migration through your normal deployment process.
5. Pass the connected database client to the adapter.

## Can I Rename Tables?

Yes, within adapter limits.

PostgreSQL, MySQL, and SQLite adapters support:

```ts
PgAdapter(pool, {
  tablePrefix: "myapp_",
  tableNames: {
    users: "identity_users",
    sessions: "identity_sessions"
  }
});
```

Prisma users can use `@@map` and `@map`. Mongoose users can change model names.

If your schema differs more deeply than table/model names, implement `DatabaseAdapter` directly. The core never depends on a specific database driver.

## Custom Adapters

Use a custom adapter when your database shape does not match the built-in adapters, for example when users live in an existing `members` table, when columns have application-specific names, or when you need extra user fields such as `username`, `tenantId`, or `profile`.

The adapter can store any schema you want, but it must return the auth contract expected by `@damn-auth/core`.

```ts
import type { DatabaseAdapter, User } from "@damn-auth/core";

type UserAdapterMethods = Pick<
  DatabaseAdapter,
  "createUser" | "getUserById" | "getUserByEmail" | "updateUser" | "deleteUser"
>;

type UserRow = {
  id: string;
  email_address: string;
  display_name: string | null;
  avatar_url: string | null;
  password_digest: string | null;
  email_verified_at: Date | null;
  role_name: string | null;
  created_at: Date;
  updated_at: Date;
  username: string | null;
};

function mapUser(row: UserRow | null): User | null {
  if (!row) return null;

  return {
    id: row.id,
    email: row.email_address,
    name: row.display_name,
    image: row.avatar_url,
    passwordHash: row.password_digest,
    emailVerified: row.email_verified_at,
    role: row.role_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function userAdapterMethods(db: MyDatabaseClient): UserAdapterMethods {
  return {
    async createUser(data) {
      const row = await db.users.insert({
        email_address: data.email,
        display_name: data.name ?? null,
        avatar_url: data.image ?? null,
        password_digest: data.passwordHash ?? null,
        email_verified_at: data.emailVerified ?? null,
        role_name: data.role ?? null
      });

      return mapUser(row)!;
    },

    async getUserById(id) {
      return mapUser(await db.users.findById(id));
    },

    async getUserByEmail(email) {
      return mapUser(await db.users.findByEmail(email));
    },

    async updateUser(id, data) {
      const row = await db.users.update(id, {
        email_address: data.email,
        display_name: data.name,
        avatar_url: data.image,
        password_digest: data.passwordHash,
        email_verified_at: data.emailVerified,
        role_name: data.role
      });

      return mapUser(row)!;
    },

    async deleteUser(id) {
      await db.users.delete(id);
    }
  };
}
```

The example above is intentionally focused on user mapping. A production adapter should use the same pattern for every required method in `DatabaseAdapter`:

- users: `createUser`, `getUserById`, `getUserByEmail`, `updateUser`, `deleteUser`
- OAuth accounts: `linkAccount`, `getAccountByProvider`, `unlinkAccount`
- sessions: `createSession`, `getSessionByToken`, `updateSession`, `deleteSession`, `deleteExpiredSessions`
- refresh tokens: `createRefreshToken`, `getRefreshToken`, `rotateRefreshToken`, `revokeRefreshToken`, `revokeAllRefreshTokensForUser`
- verification tokens: `createVerificationToken`, `getVerificationToken`, `deleteVerificationToken`
- JWT revocation, when used: `createTokenRevocation`, `getTokenRevocation`, `revokeAllTokensForUser`

Extra fields can stay in your application tables. Damn Auth will use the returned `id` as the stable link between auth data and your app data. If you return extra properties on `User`, they may exist at runtime, but the core TypeScript contract only guarantees the base fields: `id`, `email`, `name`, `image`, `passwordHash`, `emailVerified`, `role`, `createdAt`, and `updatedAt`.

## Adapter Specific Docs

- [PostgreSQL Adapter](postgresql-adapter.md)
- [Redis Cache](redis-cache.md)
- [Usage Guide](usage.md)

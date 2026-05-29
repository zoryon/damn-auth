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

## Adapter Specific Docs

- [PostgreSQL Adapter](postgresql-adapter.md)
- [Redis Cache](redis-cache.md)
- [Usage Guide](usage.md)

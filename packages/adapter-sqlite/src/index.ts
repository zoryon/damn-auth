import { randomUUID } from "node:crypto";
import type {
  Account,
  CreateRefreshTokenInput,
  CreateSessionInput,
  CreateTokenRevocationInput,
  CreateUserInput,
  CreateVerificationTokenInput,
  DatabaseAdapter,
  LinkAccountInput,
  RefreshToken,
  Session,
  TokenRevocation,
  User,
  VerificationToken
} from "@damn-auth/core";

export interface SqliteDatabase {
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number };
    get(...params: unknown[]): unknown;
  };
  exec(sql: string): void;
}

export interface SqlAdapterOptions {
  tablePrefix?: string;
  tableNames?: Partial<Record<"users" | "accounts" | "sessions" | "refreshTokens" | "verificationTokens" | "tokenRevocations", string>>;
}

function tables(options: SqlAdapterOptions = {}) {
  const prefix = options.tablePrefix ?? "";
  // Resolve table names once so every query and generated schema use the same contract.
  return {
    users: options.tableNames?.users ?? `${prefix}auth_users`,
    accounts: options.tableNames?.accounts ?? `${prefix}auth_accounts`,
    sessions: options.tableNames?.sessions ?? `${prefix}auth_sessions`,
    refreshTokens: options.tableNames?.refreshTokens ?? `${prefix}auth_refresh_tokens`,
    verificationTokens: options.tableNames?.verificationTokens ?? `${prefix}auth_verification_tokens`,
    tokenRevocations: options.tableNames?.tokenRevocations ?? `${prefix}auth_token_revocations`
  };
}

const date = (value: unknown) => (value ? new Date(String(value)) : null);
const now = () => new Date().toISOString();

function user(row: any): User | null {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image,
    passwordHash: row.password_hash,
    emailVerified: date(row.email_verified),
    role: row.role,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function account(row: any): Account | null {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    providerAccountId: row.provider_account_id,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: date(row.expires_at),
    tokenType: row.token_type,
    scope: row.scope,
    idToken: row.id_token,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function session(row: any): Session | null {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    token: row.token,
    expiresAt: new Date(row.expires_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function refresh(row: any): RefreshToken | null {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    token: row.token,
    familyId: row.family_id,
    expiresAt: new Date(row.expires_at),
    revokedAt: date(row.revoked_at),
    replacedByToken: row.replaced_by_token,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function verification(row: any): VerificationToken | null {
  if (!row) return null;
  return {
    identifier: row.identifier,
    token: row.token,
    type: row.type,
    expiresAt: new Date(row.expires_at),
    createdAt: new Date(row.created_at)
  };
}

function revocation(row: any): TokenRevocation | null {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    jti: row.jti,
    expiresAt: new Date(row.expires_at),
    createdAt: new Date(row.created_at)
  };
}

export function sqliteSchema(options: SqlAdapterOptions = {}) {
  const t = tables(options);
  // SQLite stores dates as ISO strings here so adapters still return Date objects.
  return `
CREATE TABLE IF NOT EXISTS ${t.users} (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  image TEXT,
  password_hash TEXT,
  email_verified TEXT,
  role TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ${t.accounts} (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES ${t.users}(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TEXT,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider, provider_account_id)
);
CREATE TABLE IF NOT EXISTS ${t.sessions} (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES ${t.users}(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ${t.refreshTokens} (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES ${t.users}(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  family_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  replaced_by_token TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ${t.verificationTokens} (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  type TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(identifier, token)
);
CREATE TABLE IF NOT EXISTS ${t.tokenRevocations} (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  jti TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;
}

export function SqliteAdapter(db: SqliteDatabase, options: SqlAdapterOptions = {}): DatabaseAdapter & { migrate(): void } {
  const t = tables(options);
  // Small helpers keep the repeated SELECT paths aligned with the row mappers.
  const getUser = (where: string, value: string) => user(db.prepare(`SELECT * FROM ${t.users} WHERE ${where} = ?`).get(value));
  const getSessionRow = (token: string) => session(db.prepare(`SELECT * FROM ${t.sessions} WHERE token = ?`).get(token));

  return {
    migrate() {
      db.exec(sqliteSchema(options));
    },
    async createUser(data: CreateUserInput) {
      const id = randomUUID();
      const ts = now();
      db.prepare(
        `INSERT INTO ${t.users} (id, email, name, image, password_hash, email_verified, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, data.email, data.name ?? null, data.image ?? null, data.passwordHash ?? null, data.emailVerified?.toISOString() ?? null, data.role ?? null, ts, ts);
      return (await this.getUserById(id)) as User;
    },
    async getUserById(id: string) {
      return getUser("id", id);
    },
    async getUserByEmail(email: string) {
      return getUser("email", email);
    },
    async updateUser(id, data) {
      const current = await this.getUserById(id);
      if (!current) throw new Error("User not found.");
      // SQLite has no RETURNING support in this adapter shape, so merge with the current row first.
      db.prepare(
        `UPDATE ${t.users} SET email = ?, name = ?, image = ?, password_hash = ?, email_verified = ?, role = ?, updated_at = ? WHERE id = ?`
      ).run(
        data.email ?? current.email,
        data.name ?? current.name ?? null,
        data.image ?? current.image ?? null,
        data.passwordHash ?? current.passwordHash ?? null,
        data.emailVerified?.toISOString() ?? current.emailVerified?.toISOString() ?? null,
        data.role ?? current.role ?? null,
        now(),
        id
      );
      return (await this.getUserById(id)) as User;
    },
    async deleteUser(id) {
      db.prepare(`DELETE FROM ${t.users} WHERE id = ?`).run(id);
    },
    async linkAccount(data: LinkAccountInput) {
      const id = randomUUID();
      const ts = now();
      db.prepare(
        `INSERT INTO ${t.accounts} (id, user_id, provider, provider_account_id, access_token, refresh_token, expires_at, token_type, scope, id_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, data.userId, data.provider, data.providerAccountId, data.accessToken ?? null, data.refreshToken ?? null, data.expiresAt?.toISOString() ?? null, data.tokenType ?? null, data.scope ?? null, data.idToken ?? null, ts, ts);
      return account(db.prepare(`SELECT * FROM ${t.accounts} WHERE id = ?`).get(id)) as Account;
    },
    async getAccountByProvider(provider, providerAccountId) {
      return account(db.prepare(`SELECT * FROM ${t.accounts} WHERE provider = ? AND provider_account_id = ?`).get(provider, providerAccountId));
    },
    async unlinkAccount(provider, providerAccountId) {
      db.prepare(`DELETE FROM ${t.accounts} WHERE provider = ? AND provider_account_id = ?`).run(provider, providerAccountId);
    },
    async createSession(data: CreateSessionInput) {
      const id = randomUUID();
      const ts = now();
      db.prepare(`INSERT INTO ${t.sessions} (id, user_id, token, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).run(id, data.userId, data.token, data.expiresAt.toISOString(), ts, ts);
      return getSessionRow(data.token) as Session;
    },
    async getSessionByToken(token) {
      return getSessionRow(token);
    },
    async updateSession(token, data) {
      const current = await this.getSessionByToken(token);
      if (!current) throw new Error("Session not found.");
      db.prepare(`UPDATE ${t.sessions} SET expires_at = ?, updated_at = ? WHERE token = ?`).run((data.expiresAt ?? current.expiresAt).toISOString(), now(), token);
      return getSessionRow(token) as Session;
    },
    async deleteSession(token) {
      db.prepare(`DELETE FROM ${t.sessions} WHERE token = ?`).run(token);
    },
    async deleteExpiredSessions() {
      return db.prepare(`DELETE FROM ${t.sessions} WHERE expires_at <= ?`).run(now()).changes;
    },
    async createRefreshToken(data: CreateRefreshTokenInput) {
      const id = randomUUID();
      const ts = now();
      db.prepare(
        `INSERT INTO ${t.refreshTokens} (id, user_id, token, family_id, expires_at, revoked_at, replaced_by_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, data.userId, data.token, data.familyId, data.expiresAt.toISOString(), null, data.replacedByToken ?? null, ts, ts);
      return refresh(db.prepare(`SELECT * FROM ${t.refreshTokens} WHERE token = ?`).get(data.token)) as RefreshToken;
    },
    async getRefreshToken(token) {
      return refresh(db.prepare(`SELECT * FROM ${t.refreshTokens} WHERE token = ?`).get(token));
    },
    async rotateRefreshToken(oldToken, newData) {
      const next = await this.createRefreshToken(newData);
      // Mark the old token after creating the replacement so the caller always gets the new token.
      db.prepare(`UPDATE ${t.refreshTokens} SET revoked_at = ?, replaced_by_token = ?, updated_at = ? WHERE token = ?`).run(now(), next.token, now(), oldToken);
      return next;
    },
    async revokeRefreshToken(token) {
      db.prepare(`UPDATE ${t.refreshTokens} SET revoked_at = ?, updated_at = ? WHERE token = ?`).run(now(), now(), token);
    },
    async revokeAllRefreshTokensForUser(userId) {
      return db.prepare(`UPDATE ${t.refreshTokens} SET revoked_at = ?, updated_at = ? WHERE user_id = ? AND revoked_at IS NULL`).run(now(), now(), userId).changes;
    },
    async createVerificationToken(data: CreateVerificationTokenInput) {
      db.prepare(`INSERT OR REPLACE INTO ${t.verificationTokens} (identifier, token, type, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`).run(data.identifier, data.token, data.type, data.expiresAt.toISOString(), now());
      return verification(db.prepare(`SELECT * FROM ${t.verificationTokens} WHERE identifier = ? AND token = ?`).get(data.identifier, data.token)) as VerificationToken;
    },
    async getVerificationToken(identifier, token) {
      return verification(db.prepare(`SELECT * FROM ${t.verificationTokens} WHERE identifier = ? AND token = ?`).get(identifier, token));
    },
    async deleteVerificationToken(identifier, token) {
      db.prepare(`DELETE FROM ${t.verificationTokens} WHERE identifier = ? AND token = ?`).run(identifier, token);
    },
    async createTokenRevocation(data: CreateTokenRevocationInput) {
      const id = randomUUID();
      db.prepare(`INSERT OR IGNORE INTO ${t.tokenRevocations} (id, user_id, jti, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`).run(id, data.userId ?? null, data.jti, data.expiresAt.toISOString(), now());
      return revocation(db.prepare(`SELECT * FROM ${t.tokenRevocations} WHERE jti = ?`).get(data.jti)) as TokenRevocation;
    },
    async getTokenRevocation(jti) {
      return revocation(db.prepare(`SELECT * FROM ${t.tokenRevocations} WHERE jti = ? AND expires_at > ?`).get(jti, now()));
    },
    async revokeAllTokensForUser(userId, expiresAt) {
      const id = randomUUID();
      // User-wide JWT revocation is represented as a synthetic marker for adapters that support it.
      return db.prepare(`INSERT INTO ${t.tokenRevocations} (id, user_id, jti, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`).run(id, userId, `user:${userId}:${Date.now()}`, expiresAt.toISOString(), now()).changes;
    }
  };
}

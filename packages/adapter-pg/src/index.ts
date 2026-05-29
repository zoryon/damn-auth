import type { DatabaseAdapter } from "@damn-auth/core";

export interface PgClient {
  query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

export interface PgAdapterOptions {
  tablePrefix?: string;
  tableNames?: Partial<Record<"users" | "accounts" | "sessions" | "refreshTokens" | "verificationTokens" | "tokenRevocations", string>>;
}

function tables(options: PgAdapterOptions = {}) {
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

const mapUser = (r: any) => r && ({ id: r.id, email: r.email, name: r.name, image: r.image, passwordHash: r.password_hash, emailVerified: r.email_verified, role: r.role, createdAt: r.created_at, updatedAt: r.updated_at });
const mapAccount = (r: any) => r && ({ id: r.id, userId: r.user_id, provider: r.provider, providerAccountId: r.provider_account_id, accessToken: r.access_token, refreshToken: r.refresh_token, expiresAt: r.expires_at, tokenType: r.token_type, scope: r.scope, idToken: r.id_token, createdAt: r.created_at, updatedAt: r.updated_at });
const mapSession = (r: any) => r && ({ id: r.id, userId: r.user_id, token: r.token, expiresAt: r.expires_at, createdAt: r.created_at, updatedAt: r.updated_at });
const mapRefresh = (r: any) => r && ({ id: r.id, userId: r.user_id, token: r.token, familyId: r.family_id, expiresAt: r.expires_at, revokedAt: r.revoked_at, replacedByToken: r.replaced_by_token, createdAt: r.created_at, updatedAt: r.updated_at });
const mapVerification = (r: any) => r && ({ identifier: r.identifier, token: r.token, type: r.type, expiresAt: r.expires_at, createdAt: r.created_at });
const mapRevocation = (r: any) => r && ({ id: r.id, userId: r.user_id, jti: r.jti, expiresAt: r.expires_at, createdAt: r.created_at });

export function pgSchema(options: PgAdapterOptions = {}) {
  const t = tables(options);
  // The schema string is meant to be copied into real migrations, not pushed implicitly.
  return `
CREATE TABLE IF NOT EXISTS ${t.users} (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  image text,
  password_hash text,
  email_verified timestamptz,
  role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ${t.accounts} (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES ${t.users}(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_account_id text NOT NULL,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  token_type text,
  scope text,
  id_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_account_id)
);
CREATE TABLE IF NOT EXISTS ${t.sessions} (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES ${t.users}(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ${t.refreshTokens} (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES ${t.users}(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  family_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  replaced_by_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ${t.verificationTokens} (
  identifier text NOT NULL,
  token text NOT NULL,
  type text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(identifier, token)
);
CREATE TABLE IF NOT EXISTS ${t.tokenRevocations} (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  jti text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;
}

export function PgAdapter(client: PgClient, options: PgAdapterOptions = {}): DatabaseAdapter & { migrate(): Promise<void> } {
  const t = tables(options);
  // Most adapter methods return one row, so this keeps query and mapping behavior consistent.
  const one = async <T>(sql: string, params: unknown[] = [], map: (row: any) => T | null = (row) => row) => map((await client.query(sql, params)).rows[0]);

  return {
    async migrate() {
      await client.query(pgSchema(options));
    },
    async createUser(data) {
      return (await one(`INSERT INTO ${t.users} (email, name, image, password_hash, email_verified, role) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [data.email, data.name ?? null, data.image ?? null, data.passwordHash ?? null, data.emailVerified ?? null, data.role ?? null], mapUser))!;
    },
    async getUserById(id) {
      return one(`SELECT * FROM ${t.users} WHERE id = $1`, [id], mapUser);
    },
    async getUserByEmail(email) {
      return one(`SELECT * FROM ${t.users} WHERE email = $1`, [email], mapUser);
    },
    async updateUser(id, data) {
      return (await one(`UPDATE ${t.users} SET email = COALESCE($2,email), name = COALESCE($3,name), image = COALESCE($4,image), password_hash = COALESCE($5,password_hash), email_verified = COALESCE($6,email_verified), role = COALESCE($7,role), updated_at = now() WHERE id = $1 RETURNING *`, [id, data.email, data.name, data.image, data.passwordHash, data.emailVerified, data.role], mapUser))!;
    },
    async deleteUser(id) {
      await client.query(`DELETE FROM ${t.users} WHERE id = $1`, [id]);
    },
    async linkAccount(data) {
      return (await one(`INSERT INTO ${t.accounts} (user_id, provider, provider_account_id, access_token, refresh_token, expires_at, token_type, scope, id_token) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [data.userId, data.provider, data.providerAccountId, data.accessToken ?? null, data.refreshToken ?? null, data.expiresAt ?? null, data.tokenType ?? null, data.scope ?? null, data.idToken ?? null], mapAccount))!;
    },
    async getAccountByProvider(provider, providerAccountId) {
      return one(`SELECT * FROM ${t.accounts} WHERE provider = $1 AND provider_account_id = $2`, [provider, providerAccountId], mapAccount);
    },
    async unlinkAccount(provider, providerAccountId) {
      await client.query(`DELETE FROM ${t.accounts} WHERE provider = $1 AND provider_account_id = $2`, [provider, providerAccountId]);
    },
    async createSession(data) {
      return (await one(`INSERT INTO ${t.sessions} (user_id, token, expires_at) VALUES ($1,$2,$3) RETURNING *`, [data.userId, data.token, data.expiresAt], mapSession))!;
    },
    async getSessionByToken(token) {
      return one(`SELECT * FROM ${t.sessions} WHERE token = $1`, [token], mapSession);
    },
    async updateSession(token, data) {
      return (await one(`UPDATE ${t.sessions} SET expires_at = COALESCE($2,expires_at), updated_at = now() WHERE token = $1 RETURNING *`, [token, data.expiresAt], mapSession))!;
    },
    async deleteSession(token) {
      await client.query(`DELETE FROM ${t.sessions} WHERE token = $1`, [token]);
    },
    async deleteExpiredSessions() {
      return (await client.query(`DELETE FROM ${t.sessions} WHERE expires_at <= now()`)).rowCount ?? 0;
    },
    async createRefreshToken(data) {
      return (await one(`INSERT INTO ${t.refreshTokens} (user_id, token, family_id, expires_at, replaced_by_token) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [data.userId, data.token, data.familyId, data.expiresAt, data.replacedByToken ?? null], mapRefresh))!;
    },
    async getRefreshToken(token) {
      return one(`SELECT * FROM ${t.refreshTokens} WHERE token = $1`, [token], mapRefresh);
    },
    async rotateRefreshToken(oldToken, newData) {
      const next = await this.createRefreshToken(newData);
      // Mark the old token after creating the replacement so the caller always gets the new token.
      await client.query(`UPDATE ${t.refreshTokens} SET revoked_at = now(), replaced_by_token = $2, updated_at = now() WHERE token = $1`, [oldToken, next.token]);
      return next;
    },
    async revokeRefreshToken(token) {
      await client.query(`UPDATE ${t.refreshTokens} SET revoked_at = now(), updated_at = now() WHERE token = $1`, [token]);
    },
    async revokeAllRefreshTokensForUser(userId) {
      return (await client.query(`UPDATE ${t.refreshTokens} SET revoked_at = now(), updated_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId])).rowCount ?? 0;
    },
    async createVerificationToken(data) {
      return (await one(`INSERT INTO ${t.verificationTokens} (identifier, token, type, expires_at) VALUES ($1,$2,$3,$4) ON CONFLICT(identifier, token) DO UPDATE SET type = EXCLUDED.type, expires_at = EXCLUDED.expires_at RETURNING *`, [data.identifier, data.token, data.type, data.expiresAt], mapVerification))!;
    },
    async getVerificationToken(identifier, token) {
      return one(`SELECT * FROM ${t.verificationTokens} WHERE identifier = $1 AND token = $2`, [identifier, token], mapVerification);
    },
    async deleteVerificationToken(identifier, token) {
      await client.query(`DELETE FROM ${t.verificationTokens} WHERE identifier = $1 AND token = $2`, [identifier, token]);
    },
    async createTokenRevocation(data) {
      return (await one(`INSERT INTO ${t.tokenRevocations} (user_id, jti, expires_at) VALUES ($1,$2,$3) ON CONFLICT(jti) DO UPDATE SET expires_at = EXCLUDED.expires_at RETURNING *`, [data.userId ?? null, data.jti, data.expiresAt], mapRevocation))!;
    },
    async getTokenRevocation(jti) {
      return one(`SELECT * FROM ${t.tokenRevocations} WHERE jti = $1 AND expires_at > now()`, [jti], mapRevocation);
    },
    async revokeAllTokensForUser(_userId) {
      // JWT revocation is tracked per jti here; user-wide revocation needs app-specific token ids.
      return 0;
    }
  };
}

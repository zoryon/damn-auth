import { randomUUID } from "node:crypto";
import type { DatabaseAdapter } from "@damn-auth/core";

export interface MysqlClient {
  execute<T = any>(sql: string, params?: unknown[]): Promise<[T, unknown]>;
}

export interface MysqlAdapterOptions {
  tablePrefix?: string;
  tableNames?: Partial<Record<"users" | "accounts" | "sessions" | "refreshTokens" | "verificationTokens" | "tokenRevocations", string>>;
}

function tables(options: MysqlAdapterOptions = {}) {
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

const row = (rows: any) => (Array.isArray(rows) ? rows[0] : null);
const mapUser = (r: any) => r && ({ id: r.id, email: r.email, name: r.name, image: r.image, passwordHash: r.password_hash, emailVerified: r.email_verified, role: r.role, createdAt: r.created_at, updatedAt: r.updated_at });
const mapAccount = (r: any) => r && ({ id: r.id, userId: r.user_id, provider: r.provider, providerAccountId: r.provider_account_id, accessToken: r.access_token, refreshToken: r.refresh_token, expiresAt: r.expires_at, tokenType: r.token_type, scope: r.scope, idToken: r.id_token, createdAt: r.created_at, updatedAt: r.updated_at });
const mapSession = (r: any) => r && ({ id: r.id, userId: r.user_id, token: r.token, expiresAt: r.expires_at, createdAt: r.created_at, updatedAt: r.updated_at });
const mapRefresh = (r: any) => r && ({ id: r.id, userId: r.user_id, token: r.token, familyId: r.family_id, expiresAt: r.expires_at, revokedAt: r.revoked_at, replacedByToken: r.replaced_by_token, createdAt: r.created_at, updatedAt: r.updated_at });
const mapVerification = (r: any) => r && ({ identifier: r.identifier, token: r.token, type: r.type, expiresAt: r.expires_at, createdAt: r.created_at });
const mapRevocation = (r: any) => r && ({ id: r.id, userId: r.user_id, jti: r.jti, expiresAt: r.expires_at, createdAt: r.created_at });

export function mysqlSchema(options: MysqlAdapterOptions = {}) {
  const t = tables(options);
  // MySQL clients usually execute one statement at a time, so migrate splits this string later.
  return `
CREATE TABLE IF NOT EXISTS ${t.users} (id varchar(36) PRIMARY KEY, email varchar(320) NOT NULL UNIQUE, name text, image text, password_hash text, email_verified datetime, role varchar(128), created_at datetime NOT NULL, updated_at datetime NOT NULL);
CREATE TABLE IF NOT EXISTS ${t.accounts} (id varchar(36) PRIMARY KEY, user_id varchar(36) NOT NULL, provider varchar(128) NOT NULL, provider_account_id varchar(255) NOT NULL, access_token text, refresh_token text, expires_at datetime, token_type varchar(64), scope text, id_token text, created_at datetime NOT NULL, updated_at datetime NOT NULL, UNIQUE KEY provider_account (provider, provider_account_id));
CREATE TABLE IF NOT EXISTS ${t.sessions} (id varchar(36) PRIMARY KEY, user_id varchar(36) NOT NULL, token varchar(255) NOT NULL UNIQUE, expires_at datetime NOT NULL, created_at datetime NOT NULL, updated_at datetime NOT NULL);
CREATE TABLE IF NOT EXISTS ${t.refreshTokens} (id varchar(36) PRIMARY KEY, user_id varchar(36) NOT NULL, token varchar(255) NOT NULL UNIQUE, family_id varchar(255) NOT NULL, expires_at datetime NOT NULL, revoked_at datetime, replaced_by_token varchar(255), created_at datetime NOT NULL, updated_at datetime NOT NULL);
CREATE TABLE IF NOT EXISTS ${t.verificationTokens} (identifier varchar(320) NOT NULL, token varchar(255) NOT NULL, type varchar(64) NOT NULL, expires_at datetime NOT NULL, created_at datetime NOT NULL, PRIMARY KEY(identifier, token));
CREATE TABLE IF NOT EXISTS ${t.tokenRevocations} (id varchar(36) PRIMARY KEY, user_id varchar(36), jti varchar(255) NOT NULL UNIQUE, expires_at datetime NOT NULL, created_at datetime NOT NULL);
`;
}

export function MysqlAdapter(client: MysqlClient, options: MysqlAdapterOptions = {}): DatabaseAdapter & { migrate(): Promise<void> } {
  const t = tables(options);
  const ts = () => new Date();
  // mysql2 returns rows inside a tuple; one() unwraps and maps the first row.
  const one = async (sql: string, params: unknown[], map: (r: any) => any) => map(row((await client.execute(sql, params))[0]));

  return {
    async migrate() {
      // Execute each statement separately for clients that do not allow multi-statement queries.
      for (const statement of mysqlSchema(options).split(";").map((s) => s.trim()).filter(Boolean)) {
        await client.execute(statement);
      }
    },
    async createUser(data) {
      const id = randomUUID();
      await client.execute(`INSERT INTO ${t.users} (id,email,name,image,password_hash,email_verified,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`, [id, data.email, data.name ?? null, data.image ?? null, data.passwordHash ?? null, data.emailVerified ?? null, data.role ?? null, ts(), ts()]);
      return (await this.getUserById(id))!;
    },
    getUserById: (id) => one(`SELECT * FROM ${t.users} WHERE id = ?`, [id], mapUser),
    getUserByEmail: (email) => one(`SELECT * FROM ${t.users} WHERE email = ?`, [email], mapUser),
    async updateUser(id, data) {
      await client.execute(`UPDATE ${t.users} SET email=COALESCE(?,email), name=COALESCE(?,name), image=COALESCE(?,image), password_hash=COALESCE(?,password_hash), email_verified=COALESCE(?,email_verified), role=COALESCE(?,role), updated_at=? WHERE id=?`, [data.email, data.name, data.image, data.passwordHash, data.emailVerified, data.role, ts(), id]);
      return (await this.getUserById(id))!;
    },
    async deleteUser(id) {
      await client.execute(`DELETE FROM ${t.users} WHERE id = ?`, [id]);
    },
    async linkAccount(data) {
      const id = randomUUID();
      await client.execute(`INSERT INTO ${t.accounts} (id,user_id,provider,provider_account_id,access_token,refresh_token,expires_at,token_type,scope,id_token,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [id, data.userId, data.provider, data.providerAccountId, data.accessToken ?? null, data.refreshToken ?? null, data.expiresAt ?? null, data.tokenType ?? null, data.scope ?? null, data.idToken ?? null, ts(), ts()]);
      return mapAccount(row((await client.execute(`SELECT * FROM ${t.accounts} WHERE id = ?`, [id]))[0]));
    },
    getAccountByProvider: (provider, providerAccountId) => one(`SELECT * FROM ${t.accounts} WHERE provider = ? AND provider_account_id = ?`, [provider, providerAccountId], mapAccount),
    async unlinkAccount(provider, providerAccountId) {
      await client.execute(`DELETE FROM ${t.accounts} WHERE provider = ? AND provider_account_id = ?`, [provider, providerAccountId]);
    },
    async createSession(data) {
      const id = randomUUID();
      await client.execute(`INSERT INTO ${t.sessions} (id,user_id,token,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?)`, [id, data.userId, data.token, data.expiresAt, ts(), ts()]);
      return (await this.getSessionByToken(data.token))!;
    },
    getSessionByToken: (token) => one(`SELECT * FROM ${t.sessions} WHERE token = ?`, [token], mapSession),
    async updateSession(token, data) {
      await client.execute(`UPDATE ${t.sessions} SET expires_at=COALESCE(?,expires_at), updated_at=? WHERE token=?`, [data.expiresAt, ts(), token]);
      return (await this.getSessionByToken(token))!;
    },
    async deleteSession(token) {
      await client.execute(`DELETE FROM ${t.sessions} WHERE token = ?`, [token]);
    },
    async deleteExpiredSessions() {
      const result: any = (await client.execute(`DELETE FROM ${t.sessions} WHERE expires_at <= ?`, [ts()]))[0];
      return result.affectedRows ?? 0;
    },
    async createRefreshToken(data) {
      const id = randomUUID();
      await client.execute(`INSERT INTO ${t.refreshTokens} (id,user_id,token,family_id,expires_at,replaced_by_token,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`, [id, data.userId, data.token, data.familyId, data.expiresAt, data.replacedByToken ?? null, ts(), ts()]);
      return (await this.getRefreshToken(data.token))!;
    },
    getRefreshToken: (token) => one(`SELECT * FROM ${t.refreshTokens} WHERE token = ?`, [token], mapRefresh),
    async rotateRefreshToken(oldToken, newData) {
      const next = await this.createRefreshToken(newData);
      // Mark the old token after creating the replacement so the caller always gets the new token.
      await client.execute(`UPDATE ${t.refreshTokens} SET revoked_at=?, replaced_by_token=?, updated_at=? WHERE token=?`, [ts(), next.token, ts(), oldToken]);
      return next;
    },
    async revokeRefreshToken(token) {
      await client.execute(`UPDATE ${t.refreshTokens} SET revoked_at=?, updated_at=? WHERE token=?`, [ts(), ts(), token]);
    },
    async revokeAllRefreshTokensForUser(userId) {
      const result: any = (await client.execute(`UPDATE ${t.refreshTokens} SET revoked_at=?, updated_at=? WHERE user_id=? AND revoked_at IS NULL`, [ts(), ts(), userId]))[0];
      return result.affectedRows ?? 0;
    },
    async createVerificationToken(data) {
      await client.execute(`REPLACE INTO ${t.verificationTokens} (identifier,token,type,expires_at,created_at) VALUES (?,?,?,?,?)`, [data.identifier, data.token, data.type, data.expiresAt, ts()]);
      return (await this.getVerificationToken(data.identifier, data.token))!;
    },
    getVerificationToken: (identifier, token) => one(`SELECT * FROM ${t.verificationTokens} WHERE identifier=? AND token=?`, [identifier, token], mapVerification),
    async deleteVerificationToken(identifier, token) {
      await client.execute(`DELETE FROM ${t.verificationTokens} WHERE identifier=? AND token=?`, [identifier, token]);
    },
    async createTokenRevocation(data) {
      const id = randomUUID();
      await client.execute(`INSERT IGNORE INTO ${t.tokenRevocations} (id,user_id,jti,expires_at,created_at) VALUES (?,?,?,?,?)`, [id, data.userId ?? null, data.jti, data.expiresAt, ts()]);
      return mapRevocation(row((await client.execute(`SELECT * FROM ${t.tokenRevocations} WHERE jti=? AND expires_at > ?`, [data.jti, ts()]))[0]))!;
    },
    getTokenRevocation: (jti) => one(`SELECT * FROM ${t.tokenRevocations} WHERE jti=? AND expires_at > ?`, [jti, ts()], mapRevocation),
    async revokeAllTokensForUser() {
      // JWT revocation is tracked per jti here; user-wide revocation needs app-specific token ids.
      return 0;
    }
  };
}

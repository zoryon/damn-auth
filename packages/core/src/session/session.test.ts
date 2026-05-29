import { describe, expect, it } from "vitest";
import { initAuth, type DatabaseAdapter, type User } from "../index.js";

function memoryAdapter(): DatabaseAdapter {
  const users = new Map<string, User>();
  const sessions = new Map<string, any>();
  const refreshTokens = new Map<string, any>();
  const verificationTokens = new Map<string, any>();
  return {
    async createUser(data) {
      const user: User = { id: String(users.size + 1), email: data.email, name: data.name, image: data.image, passwordHash: data.passwordHash, emailVerified: data.emailVerified, role: data.role, createdAt: new Date(), updatedAt: new Date() };
      users.set(user.id, user);
      return user;
    },
    async getUserById(id) {
      return users.get(id) ?? null;
    },
    async getUserByEmail(email) {
      return [...users.values()].find((user) => user.email === email) ?? null;
    },
    async updateUser(id, data) {
      const user = users.get(id);
      if (!user) throw new Error("missing");
      const next = { ...user, ...data, updatedAt: new Date() };
      users.set(id, next);
      return next;
    },
    async deleteUser(id) {
      users.delete(id);
    },
    async linkAccount(data) {
      return { id: "account", createdAt: new Date(), updatedAt: new Date(), ...data };
    },
    async getAccountByProvider() {
      return null;
    },
    async unlinkAccount() {},
    async createSession(data) {
      const session = { id: "session", createdAt: new Date(), updatedAt: new Date(), ...data };
      sessions.set(data.token, session);
      return session;
    },
    async getSessionByToken(token) {
      return sessions.get(token) ?? null;
    },
    async updateSession(token, data) {
      const current = sessions.get(token);
      const next = { ...current, ...data, updatedAt: new Date() };
      sessions.set(token, next);
      return next;
    },
    async deleteSession(token) {
      sessions.delete(token);
    },
    async deleteExpiredSessions() {
      return 0;
    },
    async createRefreshToken(data) {
      const token = { id: "refresh", revokedAt: null, createdAt: new Date(), updatedAt: new Date(), ...data };
      refreshTokens.set(data.token, token);
      return token;
    },
    async getRefreshToken(token) {
      return refreshTokens.get(token) ?? null;
    },
    async rotateRefreshToken(oldToken, newData) {
      const next = await this.createRefreshToken(newData);
      refreshTokens.set(oldToken, { ...refreshTokens.get(oldToken), revokedAt: new Date(), replacedByToken: next.token });
      return next;
    },
    async revokeRefreshToken(token) {
      refreshTokens.set(token, { ...refreshTokens.get(token), revokedAt: new Date() });
    },
    async revokeAllRefreshTokensForUser() {
      return 0;
    },
    async createVerificationToken(data) {
      verificationTokens.set(`${data.identifier}:${data.token}`, { createdAt: new Date(), ...data });
      return verificationTokens.get(`${data.identifier}:${data.token}`);
    },
    async getVerificationToken(identifier, token) {
      return verificationTokens.get(`${identifier}:${token}`) ?? null;
    },
    async deleteVerificationToken(identifier, token) {
      verificationTokens.delete(`${identifier}:${token}`);
    }
  };
}

describe("credentials session flow", () => {
  it("registers, signs in, and reads an opaque cookie session", async () => {
    const auth = initAuth({
      adapter: memoryAdapter(),
      crypto: { algorithm: "HS256", secret: "test-secret-that-is-long-enough" },
      logger: { level: "silent" }
    });

    await auth.signUpWithCredentials({ email: "Ada@Example.com", password: "correct horse battery staple" });
    const issued = await auth.signInWithCredentials("ada@example.com", "correct horse battery staple");
    const session = await auth.getSession({ headers: { cookie: issued.cookie } });

    expect(session?.user.email).toBe("ada@example.com");
  });
});

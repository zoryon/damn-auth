import type { DatabaseAdapter } from "@damn-auth/core";

export interface MongooseConnection {
  model(name: string, schema?: unknown): any;
}

export interface MongooseAdapterOptions {
  modelNames?: Partial<Record<"user" | "account" | "session" | "refreshToken" | "verificationToken" | "tokenRevocation", string>>;
}

const names = (options: MongooseAdapterOptions = {}) => ({
  // Allow Mongoose users to rename models while keeping the adapter method names stable.
  user: options.modelNames?.user ?? "DamnAuthUser",
  account: options.modelNames?.account ?? "DamnAuthAccount",
  session: options.modelNames?.session ?? "DamnAuthSession",
  refreshToken: options.modelNames?.refreshToken ?? "DamnAuthRefreshToken",
  verificationToken: options.modelNames?.verificationToken ?? "DamnAuthVerificationToken",
  tokenRevocation: options.modelNames?.tokenRevocation ?? "DamnAuthTokenRevocation"
});

export function mongooseSchemas(mongoose: any) {
  const { Schema } = mongoose;
  // Schemas are exported so apps can create or customize models before passing them to the adapter.
  return {
    UserSchema: new Schema(
      {
        email: { type: String, required: true, unique: true, index: true },
        name: String,
        image: String,
        passwordHash: String,
        emailVerified: Date,
        role: String
      },
      { timestamps: true }
    ),
    AccountSchema: new Schema(
      {
        userId: { type: String, required: true, index: true },
        provider: { type: String, required: true },
        providerAccountId: { type: String, required: true },
        accessToken: String,
        refreshToken: String,
        expiresAt: Date,
        tokenType: String,
        scope: String,
        idToken: String
      },
      { timestamps: true }
    ).index({ provider: 1, providerAccountId: 1 }, { unique: true }),
    SessionSchema: new Schema(
      {
        userId: { type: String, required: true, index: true },
        token: { type: String, required: true, unique: true, index: true },
        expiresAt: { type: Date, required: true, index: true }
      },
      { timestamps: true }
    ),
    RefreshTokenSchema: new Schema(
      {
        userId: { type: String, required: true, index: true },
        token: { type: String, required: true, unique: true, index: true },
        familyId: { type: String, required: true, index: true },
        expiresAt: { type: Date, required: true },
        revokedAt: Date,
        replacedByToken: String
      },
      { timestamps: true }
    ),
    VerificationTokenSchema: new Schema({
      identifier: { type: String, required: true },
      token: { type: String, required: true },
      type: { type: String, required: true },
      expiresAt: { type: Date, required: true },
      createdAt: { type: Date, default: Date.now }
    }).index({ identifier: 1, token: 1 }, { unique: true }),
    TokenRevocationSchema: new Schema({
      userId: String,
      jti: { type: String, required: true, unique: true, index: true },
      expiresAt: { type: Date, required: true, index: true },
      createdAt: { type: Date, default: Date.now }
    })
  };
}

const plain = (doc: any) => {
  if (!doc) return null;
  // Normalize Mongoose documents into plain objects with the id field expected by the core.
  const value = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return { ...value, id: String(value._id ?? value.id) };
};

export function MongooseAdapter(connection: MongooseConnection, schemas: ReturnType<typeof mongooseSchemas>, options: MongooseAdapterOptions = {}): DatabaseAdapter {
  const n = names(options);
  const User = connection.model(n.user, schemas.UserSchema);
  const Account = connection.model(n.account, schemas.AccountSchema);
  const Session = connection.model(n.session, schemas.SessionSchema);
  const RefreshToken = connection.model(n.refreshToken, schemas.RefreshTokenSchema);
  const VerificationToken = connection.model(n.verificationToken, schemas.VerificationTokenSchema);
  const TokenRevocation = connection.model(n.tokenRevocation, schemas.TokenRevocationSchema);

  return {
    createUser: async (data) => plain(await User.create(data)),
    getUserById: async (id) => plain(await User.findById(id)),
    getUserByEmail: async (email) => plain(await User.findOne({ email })),
    updateUser: async (id, data) => plain(await User.findByIdAndUpdate(id, data, { new: true })),
    deleteUser: async (id) => {
      await User.deleteOne({ _id: id });
    },
    linkAccount: async (data) => plain(await Account.create(data)),
    getAccountByProvider: async (provider, providerAccountId) => plain(await Account.findOne({ provider, providerAccountId })),
    unlinkAccount: async (provider, providerAccountId) => {
      await Account.deleteOne({ provider, providerAccountId });
    },
    createSession: async (data) => plain(await Session.create(data)),
    getSessionByToken: async (token) => plain(await Session.findOne({ token })),
    updateSession: async (token, data) => plain(await Session.findOneAndUpdate({ token }, data, { new: true })),
    deleteSession: async (token) => {
      await Session.deleteOne({ token });
    },
    deleteExpiredSessions: async () => (await Session.deleteMany({ expiresAt: { $lte: new Date() } })).deletedCount ?? 0,
    createRefreshToken: async (data) => plain(await RefreshToken.create(data)),
    getRefreshToken: async (token) => plain(await RefreshToken.findOne({ token })),
    rotateRefreshToken: async (oldToken, newData) => {
      const next = plain(await RefreshToken.create(newData));
      // Mark the old token after creating the replacement so the caller always gets the new token.
      await RefreshToken.updateOne({ token: oldToken }, { revokedAt: new Date(), replacedByToken: next.token });
      return next;
    },
    revokeRefreshToken: async (token) => {
      await RefreshToken.updateOne({ token }, { revokedAt: new Date() });
    },
    revokeAllRefreshTokensForUser: async (userId) => (await RefreshToken.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() })).modifiedCount ?? 0,
    createVerificationToken: async (data) => plain(await VerificationToken.findOneAndUpdate({ identifier: data.identifier, token: data.token }, data, { upsert: true, new: true })),
    getVerificationToken: async (identifier, token) => plain(await VerificationToken.findOne({ identifier, token })),
    deleteVerificationToken: async (identifier, token) => {
      await VerificationToken.deleteOne({ identifier, token });
    },
    createTokenRevocation: async (data) => plain(await TokenRevocation.findOneAndUpdate({ jti: data.jti }, data, { upsert: true, new: true })),
    getTokenRevocation: async (jti) => plain(await TokenRevocation.findOne({ jti, expiresAt: { $gt: new Date() } })),
    revokeAllTokensForUser: async () => {
      // JWT revocation is tracked per jti here; user-wide revocation needs app-specific token ids.
      return 0;
    }
  };
}

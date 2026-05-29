import type { DatabaseAdapter } from "@damn-auth/core";

export interface PrismaAdapterOptions {
  models?: {
    user?: string;
    account?: string;
    session?: string;
    refreshToken?: string;
    verificationToken?: string;
    tokenRevocation?: string;
  };
}

export const prismaSchema = String.raw`
model AuthUser {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  passwordHash  String?
  emailVerified DateTime?
  role          String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      AuthAccount[]
  sessions      AuthSession[]
  refreshTokens AuthRefreshToken[]

  @@map("auth_users")
}

model AuthAccount {
  id                String   @id @default(cuid())
  userId            String
  provider          String
  providerAccountId String
  accessToken       String?
  refreshToken      String?
  expiresAt         DateTime?
  tokenType         String?
  scope             String?
  idToken           String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user AuthUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("auth_accounts")
}

model AuthSession {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user AuthUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("auth_sessions")
}

model AuthRefreshToken {
  id              String    @id @default(cuid())
  userId          String
  token           String    @unique
  familyId        String
  expiresAt       DateTime
  revokedAt       DateTime?
  replacedByToken String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  user AuthUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("auth_refresh_tokens")
}

model AuthVerificationToken {
  identifier String
  token      String
  type       String
  expiresAt  DateTime
  createdAt  DateTime @default(now())

  @@id([identifier, token])
  @@map("auth_verification_tokens")
}

model AuthTokenRevocation {
  id        String   @id @default(cuid())
  userId    String?
  jti       String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@map("auth_token_revocations")
}
`;

const names = (options: PrismaAdapterOptions = {}) => ({
  // Allow Prisma users to rename models while keeping the adapter method names stable.
  user: options.models?.user ?? "authUser",
  account: options.models?.account ?? "authAccount",
  session: options.models?.session ?? "authSession",
  refreshToken: options.models?.refreshToken ?? "authRefreshToken",
  verificationToken: options.models?.verificationToken ?? "authVerificationToken",
  tokenRevocation: options.models?.tokenRevocation ?? "authTokenRevocation"
});

export function PrismaAdapter(prisma: any, options: PrismaAdapterOptions = {}): DatabaseAdapter {
  const m = names(options);
  // The adapter delegates to Prisma models directly; Prisma owns connection and migration behavior.
  return {
    createUser: (data) => prisma[m.user].create({ data }),
    getUserById: (id) => prisma[m.user].findUnique({ where: { id } }),
    getUserByEmail: (email) => prisma[m.user].findUnique({ where: { email } }),
    updateUser: (id, data) => prisma[m.user].update({ where: { id }, data }),
    deleteUser: async (id) => {
      await prisma[m.user].delete({ where: { id } });
    },
    linkAccount: (data) => prisma[m.account].create({ data }),
    getAccountByProvider: (provider, providerAccountId) =>
      prisma[m.account].findUnique({ where: { provider_providerAccountId: { provider, providerAccountId } } }),
    unlinkAccount: async (provider, providerAccountId) => {
      await prisma[m.account].delete({ where: { provider_providerAccountId: { provider, providerAccountId } } });
    },
    createSession: (data) => prisma[m.session].create({ data }),
    getSessionByToken: (token) => prisma[m.session].findUnique({ where: { token }, include: { user: true } }),
    updateSession: (token, data) => prisma[m.session].update({ where: { token }, data }),
    deleteSession: async (token) => {
      await prisma[m.session].delete({ where: { token } });
    },
    deleteExpiredSessions: async () => (await prisma[m.session].deleteMany({ where: { expiresAt: { lte: new Date() } } })).count,
    createRefreshToken: (data) => prisma[m.refreshToken].create({ data }),
    getRefreshToken: (token) => prisma[m.refreshToken].findUnique({ where: { token } }),
    rotateRefreshToken: async (oldToken, newData) =>
      // Create the replacement and revoke the old token in one Prisma transaction.
      prisma.$transaction(async (tx: any) => {
        const next = await tx[m.refreshToken].create({ data: newData });
        await tx[m.refreshToken].update({ where: { token: oldToken }, data: { revokedAt: new Date(), replacedByToken: next.token } });
        return next;
      }),
    revokeRefreshToken: async (token) => {
      await prisma[m.refreshToken].update({ where: { token }, data: { revokedAt: new Date() } });
    },
    revokeAllRefreshTokensForUser: async (userId) =>
      (await prisma[m.refreshToken].updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })).count,
    createVerificationToken: (data) => prisma[m.verificationToken].upsert({ where: { identifier_token: { identifier: data.identifier, token: data.token } }, create: data, update: data }),
    getVerificationToken: (identifier, token) => prisma[m.verificationToken].findUnique({ where: { identifier_token: { identifier, token } } }),
    deleteVerificationToken: async (identifier, token) => {
      await prisma[m.verificationToken].delete({ where: { identifier_token: { identifier, token } } });
    },
    createTokenRevocation: (data) => prisma[m.tokenRevocation].upsert({ where: { jti: data.jti }, create: data, update: { expiresAt: data.expiresAt } }),
    getTokenRevocation: (jti) => prisma[m.tokenRevocation].findFirst({ where: { jti, expiresAt: { gt: new Date() } } }),
    revokeAllTokensForUser: async () => {
      // JWT revocation is tracked per jti here; user-wide revocation needs app-specific token ids.
      return 0;
    }
  };
}

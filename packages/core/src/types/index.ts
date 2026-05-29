import type { LogConfig, LogEvent } from "@damn-auth/logger";

export type SessionStrategy = "opaque" | "jwt" | "refresh";
export type RoleMode = "exact" | "minimum";
export type JwtAlgorithm =
  | "HS256"
  | "HS384"
  | "HS512"
  | "RS256"
  | "RS384"
  | "RS512"
  | "ES256"
  | "ES384"
  | "ES512"
  | "EdDSA";

export interface User {
  id: string;
  email: string;
  name?: string | null | undefined;
  image?: string | null | undefined;
  passwordHash?: string | null | undefined;
  emailVerified?: Date | null | undefined;
  role?: string | null | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface Account {
  id: string;
  userId: string;
  provider: string;
  providerAccountId: string;
  accessToken?: string | null | undefined;
  refreshToken?: string | null | undefined;
  expiresAt?: Date | null | undefined;
  tokenType?: string | null | undefined;
  scope?: string | null | undefined;
  idToken?: string | null | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  user?: User | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefreshToken {
  id: string;
  userId: string;
  token: string;
  familyId: string;
  expiresAt: Date;
  revokedAt?: Date | null | undefined;
  replacedByToken?: string | null | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerificationToken {
  identifier: string;
  token: string;
  type: "email_verify" | "password_reset" | "csrf" | string;
  expiresAt: Date;
  createdAt: Date;
}

export interface TokenRevocation {
  id: string;
  userId?: string | null | undefined;
  jti: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface CreateUserInput {
  email: string;
  name?: string | null | undefined;
  image?: string | null | undefined;
  passwordHash?: string | null | undefined;
  emailVerified?: Date | null | undefined;
  role?: string | null | undefined;
}

export interface UpdateUserInput extends Partial<CreateUserInput> {}

export interface LinkAccountInput {
  userId: string;
  provider: string;
  providerAccountId: string;
  accessToken?: string | null | undefined;
  refreshToken?: string | null | undefined;
  expiresAt?: Date | null | undefined;
  tokenType?: string | null | undefined;
  scope?: string | null | undefined;
  idToken?: string | null | undefined;
}

export interface CreateSessionInput {
  userId: string;
  token: string;
  expiresAt: Date;
}

export interface UpdateSessionInput {
  expiresAt: Date;
}

export interface CreateRefreshTokenInput {
  userId: string;
  token: string;
  familyId: string;
  expiresAt: Date;
  replacedByToken?: string | null | undefined;
}

export interface CreateVerificationTokenInput {
  identifier: string;
  token: string;
  type: VerificationToken["type"];
  expiresAt: Date;
}

export interface CreateTokenRevocationInput {
  userId?: string | null | undefined;
  jti: string;
  expiresAt: Date;
}

export interface DatabaseAdapter {
  createUser(data: CreateUserInput): Promise<User>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  updateUser(id: string, data: Partial<UpdateUserInput>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  linkAccount(data: LinkAccountInput): Promise<Account>;
  getAccountByProvider(provider: string, providerAccountId: string): Promise<Account | null>;
  unlinkAccount(provider: string, providerAccountId: string): Promise<void>;
  createSession(data: CreateSessionInput): Promise<Session>;
  getSessionByToken(token: string): Promise<Session | null>;
  updateSession(token: string, data: Partial<UpdateSessionInput>): Promise<Session>;
  deleteSession(token: string): Promise<void>;
  deleteExpiredSessions(): Promise<number>;
  createRefreshToken(data: CreateRefreshTokenInput): Promise<RefreshToken>;
  getRefreshToken(token: string): Promise<RefreshToken | null>;
  rotateRefreshToken(oldToken: string, newData: CreateRefreshTokenInput): Promise<RefreshToken>;
  revokeRefreshToken(token: string): Promise<void>;
  revokeAllRefreshTokensForUser(userId: string): Promise<number>;
  createVerificationToken(data: CreateVerificationTokenInput): Promise<VerificationToken>;
  getVerificationToken(identifier: string, token: string): Promise<VerificationToken | null>;
  deleteVerificationToken(identifier: string, token: string): Promise<void>;
  createTokenRevocation?(data: CreateTokenRevocationInput): Promise<TokenRevocation>;
  getTokenRevocation?(jti: string): Promise<TokenRevocation | null>;
  revokeAllTokensForUser?(userId: string, expiresAt: Date): Promise<number>;
}

export interface CacheAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface CacheConfig {
  enabled: boolean;
  adapter?: CacheAdapter | undefined;
  prefix: string;
  ttl: number;
  user: {
    enabled: boolean;
    ttl: number;
  };
}

export interface CookieOptions {
  httpOnly?: boolean | undefined;
  secure?: boolean | undefined;
  sameSite?: "lax" | "strict" | "none" | undefined;
  path?: string | undefined;
  domain?: string | undefined;
  maxAge?: number | undefined;
}

export interface SessionConfig {
  strategy: SessionStrategy;
  retention: number;
  cookieName: string;
  cookieOptions: CookieOptions;
  accessToken: {
    expiresIn: number;
    deliveryMode: "body" | "header";
  };
  refreshToken: {
    expiresIn: number;
    cookieName: string;
    rotationEnabled: boolean;
  };
}

export interface CryptoConfig {
  algorithm: JwtAlgorithm;
  secret?: string | undefined;
  privateKey?: string | undefined;
  publicKey?: string | undefined;
  keyLength: 2048 | 4096;
  passwordHashAlgo: "argon2id" | "bcrypt";
  bcryptRounds: number;
}

export interface OAuthProviderConfig {
  id: string;
  type?: "oauth2" | "oidc" | undefined;
  issuer?: string | undefined;
  clientId: string;
  clientSecret: string;
  authorizationUrl?: string | undefined;
  tokenUrl?: string | undefined;
  userInfoUrl?: string | undefined;
  scope?: string[] | undefined;
}

export interface RolesConfig {
  enabled: boolean;
  defaultRole: string;
  hierarchy: string[];
}

export interface UrlsConfig {
  basePath: string;
  signIn: string;
  signOut: string;
  callback: string;
  error: string;
  afterSignIn: string;
  afterSignOut: string;
}

export interface AuthConfig {
  adapter: DatabaseAdapter;
  cache?: Partial<CacheConfig> | undefined;
  session?: Partial<SessionConfig> | undefined;
  crypto: Partial<CryptoConfig>;
  providers?: OAuthProviderConfig[] | undefined;
  roles?: Partial<RolesConfig> | undefined;
  urls?: Partial<UrlsConfig> | undefined;
  logger?: LogConfig | undefined;
  allowInsecureCookiesInProduction?: boolean | undefined;
}

export interface ResolvedAuthConfig {
  adapter: DatabaseAdapter;
  cache: CacheConfig;
  session: SessionConfig;
  crypto: CryptoConfig;
  providers: OAuthProviderConfig[];
  roles: RolesConfig;
  urls: UrlsConfig;
  logger: LogConfig;
  allowInsecureCookiesInProduction: boolean;
}

export interface AuthSession {
  user: User;
  session?: Session | undefined;
  accessToken?: string | undefined;
  claims?: Record<string, unknown> | undefined;
}

export interface AuthInstance {
  config: ResolvedAuthConfig;
  getSession(request: RequestLike): Promise<AuthSession | null>;
  requireSession(request: RequestLike): Promise<AuthSession>;
  signInWithCredentials(email: string, password: string): Promise<IssuedSession>;
  signUpWithCredentials(input: { email: string; password: string; name?: string | undefined }): Promise<User>;
  signOut(request: RequestLike): Promise<ResponseLike>;
  hasRole(user: User | AuthSession | null, role: string, mode?: RoleMode): boolean;
  log(event: Omit<LogEvent, "timestamp">): void;
}

export interface IssuedSession {
  user: User;
  session?: Session | undefined;
  accessToken?: string | undefined;
  refreshToken?: RefreshToken | undefined;
  cookie: string;
}

export interface RequestLike {
  headers: Headers | Record<string, string | string[] | undefined>;
  method?: string | undefined;
  url?: string | undefined;
  body?: unknown;
}

export interface ResponseLike {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
}

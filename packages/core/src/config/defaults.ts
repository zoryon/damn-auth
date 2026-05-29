import type { ResolvedAuthConfig, SessionConfig } from "../types/index.js";

export const defaultSessionConfig: SessionConfig = {
  strategy: "opaque",
  retention: 60 * 60 * 24 * 7,
  cookieName: "__auth_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  },
  accessToken: {
    expiresIn: 900,
    deliveryMode: "body"
  },
  refreshToken: {
    expiresIn: 60 * 60 * 24 * 30,
    cookieName: "__auth_refresh",
    rotationEnabled: true
  }
};

export const defaultConfig = {
  session: defaultSessionConfig,
  roles: {
    enabled: true,
    defaultRole: "user",
    hierarchy: ["guest", "user", "moderator", "admin", "superadmin"]
  },
  cache: {
    enabled: false,
    adapter: undefined,
    prefix: "damn-auth",
    ttl: 300,
    user: {
      enabled: true,
      ttl: 300
    }
  },
  urls: {
    basePath: "/auth",
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    callback: "/auth/callback",
    error: "/auth/error",
    afterSignIn: "/",
    afterSignOut: "/auth/signin"
  },
  logger: {
    level: "info",
    format: "pretty"
  },
  allowInsecureCookiesInProduction: false
} satisfies Pick<
  ResolvedAuthConfig,
  "session" | "roles" | "cache" | "urls" | "logger" | "allowInsecureCookiesInProduction"
>;

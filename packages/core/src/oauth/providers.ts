import type { OAuthProviderConfig } from "../types/index.js";

export interface ProviderDefinition {
  id: string;
  type: "oauth2" | "oidc";
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string[];
}

export const builtInProviders: Record<string, ProviderDefinition> = {
  google: {
    id: "google",
    type: "oidc",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: ["openid", "email", "profile"]
  },
  github: {
    id: "github",
    type: "oauth2",
    authorizationUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user",
    scope: ["read:user", "user:email"]
  },
  discord: {
    id: "discord",
    type: "oauth2",
    authorizationUrl: "https://discord.com/api/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    userInfoUrl: "https://discord.com/api/users/@me",
    scope: ["identify", "email"]
  },
  linkedin: {
    id: "linkedin",
    type: "oidc",
    authorizationUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    userInfoUrl: "https://api.linkedin.com/v2/userinfo",
    scope: ["openid", "profile", "email"]
  },
  microsoft: {
    id: "microsoft",
    type: "oidc",
    authorizationUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userInfoUrl: "https://graph.microsoft.com/oidc/userinfo",
    scope: ["openid", "email", "profile"]
  }
};

export function resolveProvider(config: OAuthProviderConfig): ProviderDefinition & OAuthProviderConfig {
  const builtIn = builtInProviders[config.id];
  return {
    ...builtIn,
    ...config,
    id: config.id,
    type: config.type ?? builtIn?.type ?? "oauth2",
    authorizationUrl: config.authorizationUrl ?? builtIn?.authorizationUrl ?? "",
    tokenUrl: config.tokenUrl ?? builtIn?.tokenUrl ?? "",
    userInfoUrl: config.userInfoUrl ?? builtIn?.userInfoUrl ?? "",
    scope: config.scope ?? builtIn?.scope ?? ["openid", "email", "profile"]
  };
}

import { AuthOAuthError, OAuthProviderError } from "../errors/index.js";
import { generateCodeChallenge, generateCodeVerifier } from "../crypto/index.js";
import type { OAuthProviderConfig } from "../types/index.js";
import { resolveProvider } from "./providers.js";

export interface AuthorizationUrlOptions {
  redirectUri: string;
  state: string;
  scope?: string[];
}

export function createPkcePair() {
  const verifier = generateCodeVerifier();
  return {
    verifier,
    challenge: generateCodeChallenge(verifier)
  };
}

export function buildAuthorizationUrl(providerConfig: OAuthProviderConfig, options: AuthorizationUrlOptions) {
  const provider = resolveProvider(providerConfig);
  if (!provider.authorizationUrl) {
    throw new AuthOAuthError(`Provider ${provider.id} does not define an authorization URL.`);
  }

  // PKCE keeps the callback tied to the browser that started the OAuth flow.
  const { verifier, challenge } = createPkcePair();
  const url = new URL(provider.authorizationUrl);
  url.searchParams.set("client_id", provider.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", (options.scope ?? provider.scope).join(" "));
  url.searchParams.set("state", options.state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  return { url: url.toString(), codeVerifier: verifier };
}

export async function exchangeCode(
  providerConfig: OAuthProviderConfig,
  code: string,
  verifier: string,
  options: { redirectUri: string; fetchImpl?: typeof fetch }
) {
  const provider = resolveProvider(providerConfig);
  // Tests can pass fetchImpl, while apps use the global fetch by default.
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(provider.tokenUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: options.redirectUri,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code_verifier: verifier
    })
  });

  if (!response.ok) {
    throw new OAuthProviderError(`Token exchange failed for ${provider.id}: ${response.status}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

export async function fetchUserInfo(providerConfig: OAuthProviderConfig, accessToken: string, fetchImpl: typeof fetch = fetch) {
  const provider = resolveProvider(providerConfig);
  const response = await fetchImpl(provider.userInfoUrl, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new OAuthProviderError(`Userinfo request failed for ${provider.id}: ${response.status}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

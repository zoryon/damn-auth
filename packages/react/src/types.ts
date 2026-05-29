import type { AuthSession } from "@damn-auth/core";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextValue {
  session: AuthSession | null;
  user: AuthSession["user"] | null;
  status: AuthStatus;
  accessToken: string | null;
  signIn(provider?: string, credentials?: { email: string; password: string }): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
  hasRole(role: string, mode?: "exact" | "minimum"): boolean;
}

export interface AuthProviderProps {
  children: React.ReactNode;
  sessionUrl?: string;
  signInUrl?: string;
  signOutUrl?: string;
  refreshUrl?: string;
  refreshMargin?: number;
  onSessionExpired?: () => void;
}

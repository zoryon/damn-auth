import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthContext } from "./context.js";
import type { AuthContextValue, AuthProviderProps, AuthStatus } from "./types.js";
import type { AuthSession } from "@damn-auth/core";

async function readJson(response: Response) {
  const text = await response.text();
  // Some auth endpoints return 204, so empty bodies should behave like empty JSON.
  return text ? JSON.parse(text) : {};
}

export function AuthProvider({
  children,
  sessionUrl = "/auth/session",
  signInUrl = "/auth/signin",
  signOutUrl = "/auth/signout",
  refreshUrl = "/auth/refresh",
  refreshMargin = 60,
  onSessionExpired
}: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSession = useCallback(async () => {
    // Treat the session endpoint as the source of truth when the provider mounts.
    setStatus("loading");
    const response = await fetch(sessionUrl, { credentials: "include" });
    const payload = await readJson(response);
    const nextSession = payload.session ?? null;
    setSession(nextSession);
    setAccessToken(nextSession?.accessToken ?? null);
    setStatus(nextSession ? "authenticated" : "unauthenticated");
  }, [sessionUrl]);

  const refresh = useCallback(async () => {
    const response = await fetch(refreshUrl, { method: "POST", credentials: "include" });
    if (!response.ok) {
      // A failed refresh means the browser no longer has a usable session.
      setSession(null);
      setAccessToken(null);
      setStatus("unauthenticated");
      onSessionExpired?.();
      return;
    }
    const payload = await readJson(response);
    setAccessToken(payload.accessToken ?? null);
    if (payload.user) {
      setSession({ user: payload.user, accessToken: payload.accessToken });
      setStatus("authenticated");
    }
  }, [onSessionExpired, refreshUrl]);

  const signIn = useCallback(
    async (provider?: string, credentials?: { email: string; password: string }) => {
      if (provider && !credentials) {
        // Provider sign-in leaves the SPA and lets the server start the OAuth flow.
        window.location.href = `${signInUrl}/${encodeURIComponent(provider)}`;
        return;
      }
      const response = await fetch(signInUrl, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(credentials ?? {})
      });
      if (!response.ok) {
        throw new Error("Sign in failed.");
      }
      const payload = await readJson(response);
      setSession({ user: payload.user, accessToken: payload.accessToken });
      setAccessToken(payload.accessToken ?? null);
      setStatus("authenticated");
    },
    [signInUrl]
  );

  const signOut = useCallback(async () => {
    await fetch(signOutUrl, { method: "POST", credentials: "include" });
    setSession(null);
    setAccessToken(null);
    setStatus("unauthenticated");
  }, [signOutUrl]);

  const hasRole = useCallback(
    (role: string, mode: "exact" | "minimum" = "exact") => {
      const actual = session?.user.role;
      if (!actual) return false;
      if (mode === "exact") return actual === role;
      return actual === role;
    },
    [session]
  );

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!accessToken || typeof window === "undefined") return;
    const payload = JSON.parse(atob(accessToken.split(".")[1] ?? ""));
    if (!payload.exp) return;
    // Refresh shortly before expiry so active pages do not wait for a failed request.
    const delay = Math.max(payload.exp * 1000 - Date.now() - refreshMargin * 1000, 1000);
    refreshTimer.current = setTimeout(() => void refresh(), delay);
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [accessToken, refresh, refreshMargin]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      status,
      accessToken,
      signIn,
      signOut,
      refresh,
      hasRole
    }),
    [accessToken, hasRole, refresh, session, signIn, signOut, status]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

import type { ReactNode } from "react";
import { useAuth } from "./useAuth.js";

export interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode | undefined;
  loadingFallback?: ReactNode | undefined;
  requiredRole?: string | undefined;
  roleMode?: "exact" | "minimum" | undefined;
}

export function ProtectedRoute({ children, fallback = null, loadingFallback = null, requiredRole, roleMode }: ProtectedRouteProps) {
  const auth = useAuth();
  if (auth.status === "loading") {
    return <>{loadingFallback}</>;
  }
  if (auth.status !== "authenticated") {
    return <>{fallback}</>;
  }
  if (requiredRole && !auth.hasRole(requiredRole, roleMode)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}

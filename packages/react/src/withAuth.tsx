import type { ComponentType } from "react";
import { ProtectedRoute } from "./ProtectedRoute.js";

export function withAuth<P extends object>(
  Component: ComponentType<P>,
  options: { requiredRole?: string | undefined; roleMode?: "exact" | "minimum" | undefined; fallback?: React.ReactNode | undefined } = {}
) {
  return function WithAuth(props: P) {
    return (
      <ProtectedRoute requiredRole={options.requiredRole} roleMode={options.roleMode} fallback={options.fallback}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}

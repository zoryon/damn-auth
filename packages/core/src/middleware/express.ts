import { AuthRoleError, SessionNotFoundError } from "../errors/index.js";
import type { AuthInstance, RoleMode } from "../types/index.js";

type Next = (error?: unknown) => void;
type ExpressRequest = {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  url?: string;
  auth?: unknown;
};
type ExpressResponse = {
  status(code: number): ExpressResponse;
  json(body: unknown): void;
  redirect(url: string): void;
};

export function expressMiddleware(auth: AuthInstance) {
  return async (req: ExpressRequest, _res: ExpressResponse, next: Next) => {
    try {
      req.auth = await auth.getSession(req);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAuth(auth: AuthInstance, options: { mode?: "api" | "redirect"; redirectTo?: string } = {}) {
  return async (req: ExpressRequest, res: ExpressResponse, next: Next) => {
    try {
      const session = await auth.requireSession(req);
      req.auth = session;
      next();
    } catch (error) {
      if (options.mode === "api") {
        res.status(401).json(error instanceof SessionNotFoundError ? error.toJSON() : { error: "Unauthorized" });
        return;
      }
      res.redirect(options.redirectTo ?? auth.config.urls.signIn);
    }
  };
}

export function requireRole(
  auth: AuthInstance,
  role: string | string[],
  options: { mode?: RoleMode; responseMode?: "api" | "redirect"; redirectTo?: string } = {}
) {
  return async (req: ExpressRequest, res: ExpressResponse, next: Next) => {
    try {
      const session = await auth.requireSession(req);
      // A route can accept one role or any role from a small allow-list.
      const roles = Array.isArray(role) ? role : [role];
      const allowed = roles.some((item) => auth.hasRole(session, item, options.mode));
      if (!allowed) {
        throw new AuthRoleError();
      }
      req.auth = session;
      next();
    } catch (error) {
      if (options.responseMode === "api") {
        const status = error instanceof AuthRoleError ? 403 : 401;
        res.status(status).json(error instanceof Error ? { error: error.name, message: error.message } : { error: "Unauthorized" });
        return;
      }
      res.redirect(options.redirectTo ?? auth.config.urls.signIn);
    }
  };
}

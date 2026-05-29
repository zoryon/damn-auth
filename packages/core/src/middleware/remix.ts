import type { AuthInstance, RequestLike } from "../types/index.js";

export function remixMiddleware(auth: AuthInstance) {
  return function wrap<TArgs extends { request: RequestLike; context?: Record<string, unknown> }, TResult>(
    loader: (args: TArgs & { context: NonNullable<TArgs["context"]> & { auth: Awaited<ReturnType<AuthInstance["getSession"]>> } }) => TResult
  ) {
    return async (args: TArgs) => {
      const session = await auth.getSession(args.request);
      // Preserve the existing Remix context and add auth alongside it.
      const context = {
        ...(args.context ?? {}),
        auth: session
      } as NonNullable<TArgs["context"]> & { auth: Awaited<ReturnType<AuthInstance["getSession"]>> };
      return loader({ ...args, context });
    };
  };
}

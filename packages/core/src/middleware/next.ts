import type { AuthInstance } from "../types/index.js";

export function nextMiddleware(auth: AuthInstance) {
  return async function middleware(request: Request) {
    const session = await auth.getSession(request);
    if (!session) {
      // Middleware cannot render UI, so unauthenticated users are sent to the sign-in URL.
      return Response.redirect(new URL(auth.config.urls.signIn, request.url));
    }
    return new Response(null, { status: 204 });
  };
}

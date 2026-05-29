import { generateToken } from "../crypto/index.js";
import { refreshSessionFromRequest } from "../session/index.js";
import { secondsFromNow } from "../utils/time.js";
import type { AuthInstance, RequestLike } from "../types/index.js";
import { json } from "./http.js";

export async function sessionHandler(auth: AuthInstance, request: RequestLike) {
  const session = await auth.getSession(request);
  return json({ session });
}

export async function refreshHandler(auth: AuthInstance, request: RequestLike) {
  const issued = await refreshSessionFromRequest(auth.config, request);
  return json(
    {
      user: issued.user,
      accessToken: issued.accessToken
    },
    {
      headers: {
        "set-cookie": issued.cookie
      }
    }
  );
}

export async function signOutHandler(auth: AuthInstance, request: RequestLike) {
  return auth.signOut(request);
}

export async function csrfHandler(auth: AuthInstance) {
  const token = generateToken(32);
  await auth.config.adapter.createVerificationToken({
    identifier: "csrf",
    token,
    type: "csrf",
    expiresAt: secondsFromNow(60 * 60)
  });
  return json({ csrfToken: token });
}

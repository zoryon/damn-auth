import type { AuthInstance, RequestLike } from "../types/index.js";
import { json } from "./http.js";

async function readJson(request: RequestLike) {
  if (request.body && typeof request.body === "object") {
    return request.body as Record<string, unknown>;
  }
  return {};
}

export async function signInHandler(auth: AuthInstance, request: RequestLike) {
  const body = await readJson(request);
  const issued = await auth.signInWithCredentials(String(body.email ?? ""), String(body.password ?? ""));
  return json(
    {
      user: issued.user,
      accessToken: issued.accessToken ?? null
    },
    {
      headers: {
        "set-cookie": issued.cookie
      }
    }
  );
}

export async function signUpHandler(auth: AuthInstance, request: RequestLike) {
  const body = await readJson(request);
  const input: { email: string; password: string; name?: string | undefined } = {
    email: String(body.email ?? ""),
    password: String(body.password ?? "")
  };
  if (typeof body.name === "string") {
    input.name = body.name;
  }
  const user = await auth.signUpWithCredentials(input);
  return json({ user }, { status: 201 });
}

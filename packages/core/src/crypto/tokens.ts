import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

function base64Url(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function generateToken(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

export function generateCodeVerifier() {
  return base64Url(randomBytes(32));
}

export function generateCodeChallenge(verifier: string) {
  return base64Url(createHash("sha256").update(verifier).digest());
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function deriveKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}

export function encryptSymmetric(plain: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store iv, tag, and ciphertext together so callers only persist one string.
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptSymmetric(cipherText: string, secret: string) {
  const data = Buffer.from(cipherText, "base64url");
  // The layout must match encryptSymmetric: 12 bytes iv, 16 bytes auth tag, then payload.
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

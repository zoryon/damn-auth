import { createPrivateKey, createPublicKey, createSecretKey, type KeyObject } from "node:crypto";
import { decodeJwt as joseDecodeJwt, jwtVerify, SignJWT, type JWTPayload } from "jose";
import type { CryptoConfig, JwtAlgorithm } from "../types/index.js";
import { TokenInvalidError } from "../errors/index.js";

export interface JwtSignOptions {
  algorithm: JwtAlgorithm;
  expiresIn?: number;
  issuer?: string;
  audience?: string;
  subject?: string;
  jti?: string;
}

function keyForSign(config: Pick<CryptoConfig, "algorithm" | "secret" | "privateKey">): KeyObject | Uint8Array {
  // HMAC algorithms sign with a shared secret; asymmetric algorithms sign with the private key.
  if (config.algorithm.startsWith("HS")) {
    return createSecretKey(Buffer.from(config.secret ?? "", "utf8"));
  }
  return createPrivateKey(config.privateKey ?? "");
}

function keyForVerify(config: Pick<CryptoConfig, "algorithm" | "secret" | "publicKey">): KeyObject | Uint8Array {
  // Verification mirrors signing, but asymmetric algorithms must use the public key.
  if (config.algorithm.startsWith("HS")) {
    return createSecretKey(Buffer.from(config.secret ?? "", "utf8"));
  }
  return createPublicKey(config.publicKey ?? "");
}

export async function signJwt(payload: JWTPayload, config: Pick<CryptoConfig, "algorithm" | "secret" | "privateKey">, options: Omit<JwtSignOptions, "algorithm"> = {}) {
  let jwt = new SignJWT(payload).setProtectedHeader({ alg: config.algorithm });

  if (options.subject) jwt = jwt.setSubject(options.subject);
  if (options.issuer) jwt = jwt.setIssuer(options.issuer);
  if (options.audience) jwt = jwt.setAudience(options.audience);
  if (options.jti) jwt = jwt.setJti(options.jti);
  if (options.expiresIn) jwt = jwt.setExpirationTime(`${options.expiresIn}s`);

  return jwt.setIssuedAt().sign(keyForSign(config));
}

export async function verifyJwt<T extends JWTPayload = JWTPayload>(
  token: string,
  config: Pick<CryptoConfig, "algorithm" | "secret" | "publicKey">,
  options: { issuer?: string; audience?: string } = {}
) {
  try {
    // Pin the expected algorithm so a token cannot switch verification modes.
    const verifyOptions: Parameters<typeof jwtVerify>[2] = {
      algorithms: [config.algorithm]
    };
    if (options.issuer) verifyOptions.issuer = options.issuer;
    if (options.audience) verifyOptions.audience = options.audience;
    const result = await jwtVerify(token, keyForVerify(config), verifyOptions);
    return result.payload as T;
  } catch (error) {
    throw new TokenInvalidError(error instanceof Error ? error.message : "Invalid JWT.");
  }
}

export function decodeJwt<T extends JWTPayload = JWTPayload>(token: string) {
  return joseDecodeJwt(token) as T;
}

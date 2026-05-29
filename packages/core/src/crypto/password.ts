import bcrypt from "bcryptjs";

export interface PasswordHashOptions {
  bcryptRounds?: number;
}

export async function hashPassword(plain: string, algo: "argon2id" | "bcrypt" = "bcrypt", options: PasswordHashOptions = {}) {
  if (algo === "argon2id") {
    // Argon2 stays optional so bcrypt-only installs do not need native bindings.
    const argon2 = await import("argon2").catch(() => null);
    if (!argon2) {
      throw new Error("argon2 is not installed. Install it or configure passwordHashAlgo: 'bcrypt'.");
    }
    return argon2.hash(plain, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    });
  }

  return bcrypt.hash(plain, options.bcryptRounds ?? 12);
}

export async function verifyPassword(plain: string, hash: string, algo: "argon2id" | "bcrypt" = "bcrypt") {
  if (algo === "argon2id" || hash.startsWith("$argon2")) {
    // Stored hashes win over config so existing Argon2 passwords keep working after a config change.
    const argon2 = await import("argon2").catch(() => null);
    if (!argon2) {
      throw new Error("argon2 is not installed. Install it or configure passwordHashAlgo: 'bcrypt'.");
    }
    return argon2.verify(hash, plain);
  }

  return bcrypt.compare(plain, hash);
}

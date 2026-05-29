import { z } from "zod";

export const cookieOptionsSchema = z.object({
  httpOnly: z.boolean().optional(),
  secure: z.boolean().optional(),
  sameSite: z.enum(["lax", "strict", "none"]).optional(),
  path: z.string().optional(),
  domain: z.string().optional(),
  maxAge: z.number().int().positive().optional()
});

export const authConfigSchema = z.object({
  adapter: z.object({}).passthrough(),
  cache: z
    .object({
      enabled: z.boolean().optional(),
      adapter: z
        .object({
          get: z.function().args(z.string()).returns(z.promise(z.string().nullable())),
          set: z.function().args(z.string(), z.string(), z.number()).returns(z.promise(z.void())),
          delete: z.function().args(z.string()).returns(z.promise(z.void()))
        })
        .optional(),
      prefix: z.string().min(1).optional(),
      ttl: z.number().int().positive().optional(),
      user: z
        .object({
          enabled: z.boolean().optional(),
          ttl: z.number().int().positive().optional()
        })
        .optional()
    })
    .optional(),
  session: z
    .object({
      strategy: z.enum(["opaque", "jwt", "refresh"]).optional(),
      retention: z.number().int().positive().optional(),
      cookieName: z.string().min(1).optional(),
      cookieOptions: cookieOptionsSchema.optional(),
      accessToken: z
        .object({
          expiresIn: z.number().int().positive().optional(),
          deliveryMode: z.enum(["body", "header"]).optional()
        })
        .optional(),
      refreshToken: z
        .object({
          expiresIn: z.number().int().positive().optional(),
          cookieName: z.string().min(1).optional(),
          rotationEnabled: z.boolean().optional()
        })
        .optional()
    })
    .optional(),
  crypto: z.object({
    algorithm: z
      .enum(["HS256", "HS384", "HS512", "RS256", "RS384", "RS512", "ES256", "ES384", "ES512", "EdDSA"])
      .optional(),
    secret: z.string().min(16).optional(),
    privateKey: z.string().optional(),
    publicKey: z.string().optional(),
    keyLength: z.union([z.literal(2048), z.literal(4096)]).optional(),
    passwordHashAlgo: z.enum(["argon2id", "bcrypt"]).optional(),
    bcryptRounds: z.number().int().min(10).max(15).optional()
  }),
  providers: z
    .array(
      z.object({
        id: z.string().min(1),
        type: z.enum(["oauth2", "oidc"]).optional(),
        issuer: z.string().url().optional(),
        clientId: z.string().min(1),
        clientSecret: z.string().min(1),
        authorizationUrl: z.string().url().optional(),
        tokenUrl: z.string().url().optional(),
        userInfoUrl: z.string().url().optional(),
        scope: z.array(z.string()).optional()
      })
    )
    .optional(),
  roles: z
    .object({
      enabled: z.boolean().optional(),
      defaultRole: z.string().min(1).optional(),
      hierarchy: z.array(z.string().min(1)).min(1).optional()
    })
    .optional(),
  urls: z
    .object({
      basePath: z.string().startsWith("/").optional(),
      signIn: z.string().startsWith("/").optional(),
      signOut: z.string().startsWith("/").optional(),
      callback: z.string().startsWith("/").optional(),
      error: z.string().startsWith("/").optional(),
      afterSignIn: z.string().optional(),
      afterSignOut: z.string().optional()
    })
    .optional(),
  logger: z
    .object({
      level: z.enum(["debug", "info", "warn", "error", "silent"]).optional(),
      format: z.enum(["pretty", "json"]).optional(),
      transport: z.function().args(z.any()).returns(z.void()).optional()
    })
    .optional(),
  allowInsecureCookiesInProduction: z.boolean().optional()
});

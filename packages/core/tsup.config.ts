import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    crypto: "src/crypto/index.ts",
    oauth: "src/oauth/index.ts",
    session: "src/session/index.ts",
    "middleware/express": "src/middleware/express.ts",
    "middleware/next": "src/middleware/next.ts",
    "middleware/remix": "src/middleware/remix.ts"
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["argon2"]
});

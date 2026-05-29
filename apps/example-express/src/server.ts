import express from "express";
import { initAuth, requireAuth, signInHandler, signOutHandler, signUpHandler, sessionHandler } from "@damn-auth/core";
import { PgAdapter } from "@damn-auth/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});
const adapter = PgAdapter(pool);

if (process.env.AUTH_RUN_MIGRATIONS === "true") {
  // Keep migrations explicit even in the example so production apps do not mutate databases by accident.
  await adapter.migrate();
}

const auth = initAuth({
  adapter,
  session: { strategy: "opaque" },
  crypto: {
    algorithm: "HS256",
    secret: process.env.AUTH_SECRET ?? "development-secret-change-me"
  },
  logger: { level: "debug" }
});

const app = express();
app.use(express.json());

app.post("/auth/signup", async (req, res, next) => {
  try {
    const response = await signUpHandler(auth, { headers: req.headers, body: req.body });
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
});

app.post("/auth/signin", async (req, res, next) => {
  try {
    const response = await signInHandler(auth, { headers: req.headers, body: req.body });
    res.set(response.headers).status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
});

app.get("/auth/session", async (req, res, next) => {
  try {
    const response = await sessionHandler(auth, { headers: req.headers });
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
});

app.post("/auth/signout", async (req, res, next) => {
  try {
    const response = await signOutHandler(auth, { headers: req.headers });
    res.set(response.headers).sendStatus(response.status);
  } catch (error) {
    next(error);
  }
});

app.get("/private", requireAuth(auth, { mode: "api" }), (_req, res) => {
  res.json({ ok: true });
});

app.listen(3000, () => {
  console.log("Example running at http://localhost:3000");
});

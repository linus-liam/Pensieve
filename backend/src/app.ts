import "./config/env.js";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import memoryEntriesRouter from "./routes/memoryEntries.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiRateLimit } from "./middleware/rateLimit.js";
import { requireAuth } from "./middleware/requireAuth.js";

const corsOrigin =
  process.env.FRONTEND_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:5173");

async function ensureDbSchema() {
  const { ensureSchema } = await import("./db/ensureSchema.js");
  return ensureSchema();
}

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT ?? "8kb" }));

  function mountApi(prefix: "" | "/api") {
    app.get(`${prefix}/health`, (_req, res) => res.json({ ok: true }));

    // Serverless (Vercel) has no migrate step; lazily ensure the schema exists.
    app.use(prefix, (_req, _res, next) => {
      ensureDbSchema().then(() => next(), next);
    });

    app.use(prefix, apiRateLimit);
    app.use(`${prefix}/memory-entries`, requireAuth, memoryEntriesRouter);

    app.use(prefix, (_req, res) => {
      res.status(404).json({ error: "not found", code: "not_found" });
    });
  }

  mountApi("/api");
  mountApi("");

  app.use(errorHandler);

  return app;
}

// Default app export for Vercel and test/runtime adapters.
const app = createApp();
export default app;

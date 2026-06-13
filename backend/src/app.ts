import "./config/env.js";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import memoryEntriesRouter from "./routes/memoryEntries.js";
import { ensureSchema } from "./db/ensureSchema.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiRateLimit } from "./middleware/rateLimit.js";

const corsOrigin =
  process.env.FRONTEND_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:5173");

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

  // Serverless (Vercel) has no migrate step; lazily ensure the schema exists.
  app.use("/api", (_req, _res, next) => {
    ensureSchema().then(() => next(), next);
  });

  app.use("/api", apiRateLimit);
  app.use("/api/memory-entries", memoryEntriesRouter);

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "not found", code: "not_found" });
  });

  app.use(errorHandler);

  return app;
}

// Default instance for the Vercel serverless entry (api/index.ts).
const app = createApp();
export default app;

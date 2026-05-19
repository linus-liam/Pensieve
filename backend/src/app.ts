import "dotenv/config";
import connectPgSimple from "connect-pg-simple";
import cors from "cors";
import express from "express";
import session from "express-session";
import helmet from "helmet";
import authRouter from "./routes/auth.js";
import chatsRouter from "./routes/chats.js";
import messagesRouter from "./routes/messages.js";
import { pool } from "./db/client.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiRateLimit } from "./middleware/rateLimit.js";

const isProduction = process.env.NODE_ENV === "production";
const configuredSessionSecret =
  process.env.SESSION_SECRET ?? (isProduction ? undefined : "dev-session-secret");

if (!configuredSessionSecret) {
  throw new Error("SESSION_SECRET is required in production");
}

const sessionSecret = configuredSessionSecret;
const PgSession = connectPgSimple(session);

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
      credentials: true,
    })
  );
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT ?? "32kb" }));
  app.use(
    session({
      name: "pensieve.sid",
      store: new PgSession({
        pool,
        tableName: "session",
        createTableIfMissing: false,
      }),
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
        maxAge: 1000 * 60 * 60 * 24 * 30,
      },
    })
  );

  app.use("/api", apiRateLimit);
  app.use("/api/auth", authRouter);
  app.use("/api/chats", chatsRouter);
  app.use("/api/chats/:chatId/messages", messagesRouter);

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "not found", code: "not_found" });
  });

  app.use(errorHandler);

  return app;
}

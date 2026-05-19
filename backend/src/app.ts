import express from "express";
import cors from "cors";
import chatsRouter from "./routes/chats.js";
import messagesRouter from "./routes/messages.js";
import { ensureSchema } from "./db/ensureSchema.js";

const app = express();

const corsOrigin =
  process.env.FRONTEND_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:5173");

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.use("/api", async (_req, _res, next) => {
  try {
    await ensureSchema();
    next();
  } catch (error) {
    next(error);
  }
});

app.use("/api/chats", chatsRouter);
app.use("/api/chats/:chatId/messages", messagesRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

export default app;

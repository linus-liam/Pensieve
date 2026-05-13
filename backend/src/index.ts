import "dotenv/config";
import express from "express";
import cors from "cors";
import chatsRouter from "./routes/chats.js";
import messagesRouter from "./routes/messages.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:5173" }));
app.use(express.json());

app.use("/api/chats", chatsRouter);
app.use("/api/chats/:chatId/messages", messagesRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Pensieve backend running on http://localhost:${PORT}`);
});

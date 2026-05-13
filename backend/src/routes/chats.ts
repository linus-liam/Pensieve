import { Router } from "express";
import { listChats, createChat, updateChatTitle, getMessages } from "../services/chatService.js";

const router = Router();

router.get("/", async (_req, res) => {
  const chats = await listChats();
  res.json(chats);
});

router.post("/", async (req, res) => {
  const chat = await createChat(req.body?.title);
  res.status(201).json(chat);
});

router.patch("/:id/title", async (req, res) => {
  const { title } = req.body ?? {};
  if (!title) return res.status(400).json({ error: "title required" });
  const chat = await updateChatTitle(req.params.id, title);
  if (!chat) return res.status(404).json({ error: "not found" });
  res.json(chat);
});

router.get("/:id/messages", async (req, res) => {
  const messages = await getMessages(req.params.id);
  res.json(messages);
});

export default router;

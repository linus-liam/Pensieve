import { Router } from "express";
import { listChats, createChat, deleteChat, getMessages } from "../services/chatService.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { parsePagination, requireText, requireUuid } from "../utils/validation.js";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(async (req, res) => {
  const { limit, offset } = parsePagination(req.query);
  const chats = await listChats(req.user!.id, limit, offset);
  res.json(chats);
}));

router.post("/", asyncHandler(async (req, res) => {
  const title =
    typeof req.body?.title === "string" && req.body.title.trim()
      ? requireText(req.body.title, "title", 120)
      : "New entry";
  const chat = await createChat(req.user!.id, title);
  res.status(201).json(chat);
}));

router.get("/:id/messages", asyncHandler(async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  const messages = await getMessages(req.user!.id, id);
  res.json(messages);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  const deleted = await deleteChat(req.user!.id, id);
  if (!deleted) return res.status(404).json({ error: "not found", code: "not_found" });
  res.status(204).end();
}));

export default router;

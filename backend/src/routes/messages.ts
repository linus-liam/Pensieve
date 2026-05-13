import { Router, type Request } from "express";
import { addMessage, getMessages } from "../services/chatService.js";
import { getAIReply, generateTitle } from "../services/aiService.js";
import { updateChatTitle } from "../services/chatService.js";

const router = Router({ mergeParams: true });

router.post("/", async (req: Request<{ chatId: string }>, res) => {
  const { content } = req.body ?? {};
  const { chatId } = req.params;

  if (!content?.trim()) return res.status(400).json({ error: "content required" });

  const userMsg = await addMessage(chatId, "user", content.trim());

  const history = await getMessages(chatId);
  const aiText = await getAIReply(
    history.map((m) => ({ role: m.role, content: m.content }))
  );
  const assistantMsg = await addMessage(chatId, "assistant", aiText);

  // Auto-title from first user message
  if (history.filter((m) => m.role === "user").length === 1) {
    generateTitle(content.trim())
      .then((title) => updateChatTitle(chatId, title))
      .catch(() => {});
  }

  res.status(201).json({ userMessage: userMsg, assistantMessage: assistantMsg });
});

export default router;

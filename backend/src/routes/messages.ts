import { Router, type Request } from "express";
import { addMessage, getMessages, updateChatTitle, withTransaction } from "../services/chatService.js";
import { getAIReply, generateTitle } from "../services/aiService.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { messageRateLimit } from "../middleware/rateLimit.js";
import { requireText, requireUuid } from "../utils/validation.js";

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.post("/", messageRateLimit, asyncHandler(async (req: Request<{ chatId: string }>, res) => {
  const content = requireText(req.body?.content, "content", 8000);
  const chatId = requireUuid(req.params.chatId, "chatId");
  const userId = req.user!.id;

  const history = await getMessages(userId, chatId);
  const nextHistory = [...history, { role: "user" as const, content }];
  const aiText = await getAIReply(nextHistory.map((m) => ({ role: m.role, content: m.content })));

  const shouldTitle = history.filter((m) => m.role === "user").length === 0;
  const title = shouldTitle ? await generateTitle(content) : null;

  const result = await withTransaction(async (client) => {
    const userMessage = await addMessage(userId, chatId, "user", content, client);
    const assistantMessage = await addMessage(userId, chatId, "assistant", aiText, client);
    const chat = title ? await updateChatTitle(userId, chatId, title, client) : null;

    return { userMessage, assistantMessage, chat };
  });

  res.status(201).json(result);
}));

export default router;

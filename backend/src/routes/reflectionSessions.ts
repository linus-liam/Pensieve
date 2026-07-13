import { Router } from "express";
import type { Request } from "express";
import { AppError } from "../errors.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  appendReflectionMessage,
  confirmReflectionMemory,
  createReflectionSession,
  getActiveReflectionSession,
  getReflectionSession,
} from "../services/reflectionSessionService.js";
import { requireText, requireUuid } from "../utils/validation.js";

const router = Router();
const MAX_MESSAGE_CHARS = Number(process.env.MEMORY_RAW_INPUT_MAX_CHARS ?? 2000);
const MAX_MEMORY_TITLE_CHARS = 120;
const MAX_MEMORY_SUMMARY_CHARS = 600;

function requireAuthUserId(req: Request) {
  const userId = req.authUser?.id;
  if (!userId) throw new AppError(401, "authentication required", "auth_required");
  return userId;
}

router.get(
  "/active",
  asyncHandler(async (req, res) => {
    const detail = await getActiveReflectionSession(requireAuthUserId(req));
    if (!detail) throw new AppError(404, "active reflection session not found", "not_found");
    res.json(detail);
  })
);

router.post(
  "/:id/messages",
  asyncHandler(async (req, res) => {
    const result = await appendReflectionMessage({
      userId: requireAuthUserId(req),
      sessionId: requireUuid(req.params.id, "id"),
      clientMessageId: requireUuid(req.body?.clientMessageId, "clientMessageId"),
      content: requireText(req.body?.content, "content", MAX_MESSAGE_CHARS),
    });
    res.status(result.replayed ? 200 : 201).json(result);
  })
);

router.post(
  "/:id/memory",
  asyncHandler(async (req, res) => {
    const entry = await confirmReflectionMemory({
      userId: requireAuthUserId(req),
      sessionId: requireUuid(req.params.id, "id"),
      assistantMessageId: requireUuid(req.body?.assistantMessageId, "assistantMessageId"),
      title: requireText(req.body?.title, "title", MAX_MEMORY_TITLE_CHARS),
      summary: requireText(req.body?.summary, "summary", MAX_MEMORY_SUMMARY_CHARS),
    });
    res.status(201).json(entry);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const detail = await createReflectionSession(requireAuthUserId(req));
    res.status(201).json(detail);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = requireUuid(req.params.id, "id");
    res.json(await getReflectionSession(requireAuthUserId(req), id));
  })
);

export default router;

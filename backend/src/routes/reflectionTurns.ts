import { Router } from "express";
import type { Request } from "express";
import { AppError } from "../errors.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { continueReflection } from "../services/aiService.js";
import type { ReflectionChatMessage, ReflectionMessageRole } from "../types.js";
import { requireText } from "../utils/validation.js";

const router = Router();
const MAX_MESSAGE_CHARS = Number(process.env.MEMORY_RAW_INPUT_MAX_CHARS ?? 2000);
const MAX_REFLECTION_MESSAGES = Number(process.env.MAX_REFLECTION_MESSAGES ?? 24);

function requireAuthUserId(req: Request) {
  const userId = req.authUser?.id;
  if (!userId) throw new AppError(401, "authentication required", "auth_required");
  return userId;
}

function requireReflectionMessages(value: unknown): ReflectionChatMessage[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError(400, "messages are required", "invalid_input");
  }

  const messages = value.slice(-MAX_REFLECTION_MESSAGES).map((candidate, index) => {
    if (!candidate || typeof candidate !== "object") {
      throw new AppError(400, `messages[${index}] must be an object`, "invalid_input");
    }

    const role = (candidate as { role?: unknown }).role;
    if (role !== "assistant" && role !== "user") {
      throw new AppError(400, `messages[${index}].role is invalid`, "invalid_input");
    }

    return {
      role: role as ReflectionMessageRole,
      content: requireText(
        (candidate as { content?: unknown }).content,
        `messages[${index}].content`,
        MAX_MESSAGE_CHARS
      ),
    };
  });

  if (messages[messages.length - 1]?.role !== "user") {
    throw new AppError(400, "last message must be from the user", "invalid_input");
  }

  return messages;
}

router.post(
  "/",
  asyncHandler(async (req, res) => {
    requireAuthUserId(req);
    const messages = requireReflectionMessages(req.body?.messages);
    const reflection = await continueReflection(messages);
    res.status(201).json(reflection);
  })
);

export default router;

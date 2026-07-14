import { Router } from "express";
import type { Request } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { memoryWriteRateLimit } from "../middleware/rateLimit.js";
import {
  createMemoryEntry,
  deleteMemoryEntry,
  getMemoryEntry,
  listMemoryEntries,
  updateMemoryEntry,
} from "../services/memoryEntryService.js";
import { parsePagination, requireText, requireUuid } from "../utils/validation.js";
import { AppError } from "../errors.js";

const router = Router();
const MAX_RAW_INPUT_CHARS = Number(process.env.MEMORY_RAW_INPUT_MAX_CHARS ?? 2000);
const MAX_MEMORY_TITLE_CHARS = 120;
const MAX_MEMORY_SUMMARY_CHARS = 600;

function requireAuthUserId(req: Request) {
  const userId = req.authUser?.id;
  if (!userId) throw new AppError(401, "authentication required", "auth_required");
  return userId;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { limit, offset } = parsePagination(req.query);
    const entries = await listMemoryEntries(requireAuthUserId(req), limit, offset);
    res.json(entries);
  })
);

router.post(
  "/",
  memoryWriteRateLimit,
  asyncHandler(async (req, res) => {
    const rawInput = requireText(
      req.body?.rawInput ?? req.body?.raw_input,
      "rawInput",
      MAX_RAW_INPUT_CHARS
    );
    const entry = await createMemoryEntry(requireAuthUserId(req), rawInput);
    res.status(201).json(entry);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = requireUuid(req.params.id, "id");
    const entry = await getMemoryEntry(requireAuthUserId(req), id);
    res.json(entry);
  })
);

router.patch(
  "/:id",
  memoryWriteRateLimit,
  asyncHandler(async (req, res) => {
    const id = requireUuid(req.params.id, "id");
    const rawInputValue = req.body?.rawInput ?? req.body?.raw_input;
    const summaryValue = req.body?.summary ?? req.body?.ai_summary;
    const titleValue = req.body?.title;

    if (rawInputValue === undefined && summaryValue === undefined && titleValue === undefined) {
      throw new AppError(400, "at least one memory field is required", "invalid_input");
    }

    const entry = await updateMemoryEntry(requireAuthUserId(req), id, {
      rawInput:
        rawInputValue === undefined
          ? undefined
          : requireText(rawInputValue, "rawInput", MAX_RAW_INPUT_CHARS),
      summary:
        summaryValue === undefined
          ? undefined
          : requireText(summaryValue, "summary", MAX_MEMORY_SUMMARY_CHARS),
      title:
        titleValue === undefined
          ? undefined
          : requireText(titleValue, "title", MAX_MEMORY_TITLE_CHARS),
    });
    res.json(entry);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = requireUuid(req.params.id, "id");
    const deleted = await deleteMemoryEntry(requireAuthUserId(req), id);
    if (!deleted) return res.status(404).json({ error: "not found", code: "not_found" });
    res.status(204).end();
  })
);

export default router;

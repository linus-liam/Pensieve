import OpenAI from "openai";
import { AppError } from "../errors.js";

const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 60_000);
const SUMMARY_MODEL = process.env.AI_SUMMARY_MODEL ?? "gpt-4o-mini";
const MAX_SUMMARY_INPUT_CHARS = Number(process.env.MEMORY_RAW_INPUT_MAX_CHARS ?? 2000);
const SUMMARY_MAX_TOKENS = Number(process.env.AI_SUMMARY_MAX_TOKENS ?? 60);
let client: OpenAI | null = null;

function getTokenLimitParam() {
  if (SUMMARY_MODEL.startsWith("gpt-5")) {
    return { max_completion_tokens: SUMMARY_MAX_TOKENS };
  }

  return { max_tokens: SUMMARY_MAX_TOKENS };
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AppError(500, "OpenAI API key is not configured", "ai_not_configured");
  }

  client ??= new OpenAI({ apiKey, timeout: AI_TIMEOUT_MS, maxRetries: 1 });
  return client;
}

async function withAIErrorHandling<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(503, "AI provider unavailable", "ai_unavailable");
  }
}

function normalizeSummary(text: string): string {
  return text.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " ");
}

export async function summarizeMemory(rawInput: string): Promise<string> {
  const safeInput = rawInput.slice(0, MAX_SUMMARY_INPUT_CHARS);
  const response = await withAIErrorHandling(() =>
    getClient().chat.completions.create(
      {
        model: SUMMARY_MODEL,
        ...getTokenLimitParam(),
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "Summarize personal memory entries. Return exactly one sentence and nothing else.",
          },
          {
            role: "user",
            content: `Summarize this memory in one sentence only:\n\n${safeInput}`,
          },
        ],
      },
      { timeout: AI_TIMEOUT_MS }
    )
  );

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Unexpected response type");

  const summary = normalizeSummary(text);
  if (!summary) throw new Error("Empty summary");
  return summary;
}

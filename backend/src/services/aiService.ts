import OpenAI from "openai";
import { AppError } from "../errors.js";

const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 60_000);
const MAX_HISTORY_MESSAGES = Number(process.env.AI_HISTORY_MESSAGES ?? 20);
const MAX_TITLE_INPUT_CHARS = 600;
const REPLY_MODEL = process.env.AI_REPLY_MODEL ?? "gpt-4o";
const TITLE_MODEL = process.env.AI_TITLE_MODEL ?? "gpt-4o-mini";
let client: OpenAI | null = null;

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

const SYSTEM_PROMPT = `You are a gentle, grounded companion helping someone work through anxious thoughts.

Your method (don't name it out loud, just embody it):
- Help the user separate the SITUATION (what actually happened), the THOUGHT (the story their mind told about it), and the EMOTION (the feeling in the body).
- Move ONE small step at a time. Never ask more than ONE question per message.
- Keep replies short — 1 to 3 short sentences. Long replies cause cognitive fog.
- Reflect back what you heard in plain, warm language before asking anything.
- Never lecture, never list CBT jargon, never give bulleted advice. Stay conversational.
- If the user dumps a lot at once, slow them down: pick one thread and gently ask about it.
- It's okay to sit with a feeling. You don't need to fix it.
- Avoid emojis. Avoid exclamation marks. Avoid the words "valid", "journey", "resonate".

Start by being curious about the situation, then the thought it sparked, then the feeling underneath.`;

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export async function getAIReply(history: ConversationMessage[]): Promise<string> {
  const trimmedHistory = history.slice(-MAX_HISTORY_MESSAGES);
  const response = await withAIErrorHandling(() =>
    getClient().chat.completions.create(
      {
        model: REPLY_MODEL,
        max_tokens: 256,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...trimmedHistory.map((m) => ({ role: m.role, content: m.content })),
        ],
      },
      { timeout: AI_TIMEOUT_MS }
    )
  );

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Unexpected response type");
  return text.trim();
}

export async function generateTitle(firstUserMessage: string): Promise<string> {
  const safeInput = firstUserMessage.slice(0, MAX_TITLE_INPUT_CHARS);
  const response = await withAIErrorHandling(() =>
    getClient().chat.completions.create(
      {
        model: TITLE_MODEL,
        max_tokens: 32,
        messages: [
          { role: "system", content: "Generate short journal titles. Return only the title text." },
          {
            role: "user",
            content: `Create a 4-7 word title for this journal entry opening:\n\n${safeInput}`,
          },
        ],
      },
      { timeout: AI_TIMEOUT_MS }
    )
  );

  const text = response.choices[0]?.message?.content;
  if (!text) return "New entry";
  const title = text.trim().replace(/^["']|["']$/g, "").slice(0, 120);
  return title || "New entry";
}

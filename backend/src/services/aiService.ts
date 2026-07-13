import OpenAI from "openai";
import { AppError } from "../errors.js";
import type {
  ProposalEvidence,
  ReflectionAIMessage,
  ReflectionChatMessage,
  ReflectionTurnResponse,
} from "../types.js";

const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 60_000);
const SUMMARY_MODEL = process.env.AI_SUMMARY_MODEL ?? "gpt-4o-mini";
const ACKNOWLEDGEMENT_MODEL = process.env.AI_ACKNOWLEDGEMENT_MODEL ?? SUMMARY_MODEL;
const REFLECTION_MODEL = process.env.AI_REFLECTION_MODEL ?? "gpt-5.4-mini";
const MAX_SUMMARY_INPUT_CHARS = Number(process.env.MEMORY_RAW_INPUT_MAX_CHARS ?? 2000);
const SUMMARY_MAX_TOKENS = Number(process.env.AI_SUMMARY_MAX_TOKENS ?? 60);
const ACKNOWLEDGEMENT_MAX_TOKENS = Number(process.env.AI_ACKNOWLEDGEMENT_MAX_TOKENS ?? 80);
const ACKNOWLEDGEMENT_FALLBACK =
  "I'm with you in that. What part of this feels most important to understand next?";
const MAX_REFLECTION_REPLY_CHARS = Number(process.env.AI_REFLECTION_REPLY_MAX_CHARS ?? 500);
const MAX_PROPOSAL_TITLE_CHARS = 120;
const MAX_PROPOSAL_SUMMARY_CHARS = 600;
const MEMORY_PERMISSION_QUESTION =
  /\b(would you like|do you want|want me to|should i|shall i|can i)\b[\s\S]{0,120}\b(save|keep|store|remember|capture|hold onto|turn this into)\b[\s\S]{0,80}\b(memory|reflection|note|entry|this|that|it)\b/i;
let client: OpenAI | null = null;

function getTokenLimitParam(model: string, maxTokens: number) {
  if (model.startsWith("gpt-5")) {
    return { max_completion_tokens: maxTokens };
  }

  return { max_tokens: maxTokens };
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

function normalizeShortText(text: string): string {
  return text.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " ");
}

function asksToSaveMemory(text: string): boolean {
  return MEMORY_PERMISSION_QUESTION.test(text);
}

function asksQuestion(text: string): boolean {
  return text.includes("?");
}

function questionCount(text: string): number {
  return text.match(/\?/g)?.length ?? 0;
}

function normalizeReflectionMessages(messages: ReflectionChatMessage[]): ReflectionAIMessage[] {
  return messages.map((message, index) => ({
    id: message.id?.trim() || `transcript-${index + 1}`,
    role: message.role,
    content: message.content,
  }));
}

function requireBoundedText(value: unknown, maxChars: number): string {
  const text = typeof value === "string" ? normalizeShortText(value) : "";
  if (!text || text.length > maxChars) throw new Error("Invalid reflection response");
  return text;
}

function validateEvidence(
  value: unknown,
  messages: ReflectionAIMessage[]
): ProposalEvidence[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 4) {
    throw new Error("Invalid reflection response");
  }

  const userMessages = new Map(
    messages.filter((message) => message.role === "user").map((message) => [message.id, message.content])
  );
  const seen = new Set<string>();

  return value.map((candidate) => {
    if (!candidate || typeof candidate !== "object") {
      throw new Error("Invalid reflection response");
    }

    const userMessageId = requireBoundedText(
      (candidate as { userMessageId?: unknown }).userMessageId,
      200
    );
    const excerpt = requireBoundedText((candidate as { excerpt?: unknown }).excerpt, 500);
    const source = userMessages.get(userMessageId);
    const key = `${userMessageId}\u0000${excerpt}`;
    if (!source || !source.includes(excerpt) || seen.has(key)) {
      throw new Error("Invalid reflection response");
    }
    seen.add(key);
    return { userMessageId, excerpt };
  });
}

export function parseReflectionResponse(
  content: string,
  messages: ReflectionAIMessage[] = []
): ReflectionTurnResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Invalid reflection response");
  }

  if (!parsed || typeof parsed !== "object") throw new Error("Invalid reflection response");

  const candidate = parsed as {
    state?: unknown;
    reply?: unknown;
    memoryProposal?: {
      title?: unknown;
      summary?: unknown;
      evidence?: unknown;
    } | null;
  };
  const reply = requireBoundedText(candidate.reply, MAX_REFLECTION_REPLY_CHARS);

  if (candidate.state === "exploring") {
    if (candidate.memoryProposal !== null || questionCount(reply) !== 1) {
      throw new Error("Invalid reflection response");
    }
    return { state: "exploring", reply, memoryProposal: null };
  }

  if (candidate.state !== "proposal_ready" || !candidate.memoryProposal) {
    throw new Error("Invalid reflection response");
  }

  const title = requireBoundedText(candidate.memoryProposal.title, MAX_PROPOSAL_TITLE_CHARS);
  const summary = requireBoundedText(
    candidate.memoryProposal.summary,
    MAX_PROPOSAL_SUMMARY_CHARS
  );
  const evidence = validateEvidence(candidate.memoryProposal.evidence, messages);
  return {
    state: "proposal_ready",
    reply,
    memoryProposal: { title, summary, evidence },
  };
}

function parseReflectionAIOutput(
  content: string | null | undefined,
  messages: ReflectionAIMessage[]
): ReflectionTurnResponse {
  try {
    if (!content) throw new Error("Invalid reflection response");
    return parseReflectionResponse(content, messages);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(503, "Invalid reflection response", "invalid_ai_response");
  }
}

export function formatReflectionTranscript(
  messages: Pick<ReflectionChatMessage, "role" | "content">[],
  maxChars = MAX_SUMMARY_INPUT_CHARS * 4
): string {
  const lines = messages
    .slice(-12)
    .map((message) => `${message.role === "assistant" ? "Pensieve" : "User"}: ${message.content}`);
  const prefix = "[Earlier transcript truncated]";
  let transcript = "";
  let truncated = false;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    const candidate = transcript ? `${line}\n${transcript}` : line;
    if (candidate.length <= maxChars) {
      transcript = candidate;
      continue;
    }

    truncated = true;
    if (!transcript) transcript = line.slice(-maxChars);
    break;
  }

  return truncated ? `${prefix}\n${transcript}` : transcript;
}

export async function summarizeMemory(rawInput: string): Promise<string> {
  const safeInput = rawInput.slice(0, MAX_SUMMARY_INPUT_CHARS);
  const response = await withAIErrorHandling(() =>
    getClient().chat.completions.create(
      {
        model: SUMMARY_MODEL,
        ...getTokenLimitParam(SUMMARY_MODEL, SUMMARY_MAX_TOKENS),
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

  const summary = normalizeShortText(text);
  if (!summary) throw new Error("Empty summary");
  return summary;
}

export async function acknowledgeMemory(rawInput: string): Promise<string> {
  const safeInput = rawInput.slice(0, MAX_SUMMARY_INPUT_CHARS);
  const response = await withAIErrorHandling(() =>
    getClient().chat.completions.create(
      {
        model: ACKNOWLEDGEMENT_MODEL,
        ...getTokenLimitParam(ACKNOWLEDGEMENT_MODEL, ACKNOWLEDGEMENT_MAX_TOKENS),
        temperature: 0.5,
        messages: [
          {
            role: "system",
            content:
              "You are Pensieve, a calm reflection companion. Reply with one or two short sentences. First reflect the user's experience in plain language, then ask exactly one grounded follow-up question that helps them add useful detail or clarify what is really happening. Do not summarize mechanically, diagnose, list possibilities, give frameworks, or give advice unless asked. Do not mention being an AI. Do not ask whether to save this, keep it, remember it, or turn it into a memory.",
          },
          {
            role: "user",
            content: `This entry has already been captured. Acknowledge it without asking whether to save it. Ask one grounded follow-up question:\n\n${safeInput}`,
          },
        ],
      },
      { timeout: AI_TIMEOUT_MS }
    )
  );

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Unexpected response type");

  const acknowledgement = normalizeShortText(text);
  if (!acknowledgement) throw new Error("Empty acknowledgement");
  if (asksToSaveMemory(acknowledgement)) return ACKNOWLEDGEMENT_FALLBACK;
  if (!asksQuestion(acknowledgement)) return ACKNOWLEDGEMENT_FALLBACK;
  return acknowledgement;
}

export async function continueReflection(
  messages: ReflectionChatMessage[]
): Promise<ReflectionTurnResponse> {
  const normalizedMessages = normalizeReflectionMessages(messages);
  const safeTranscript = formatReflectionTranscript(
    normalizedMessages.map((message) => ({
      role: message.role,
      content: `${message.id}: ${message.content}`,
    }))
  );

  const response = await withAIErrorHandling(() =>
    getClient().chat.completions.create(
      {
        model: REFLECTION_MODEL,
        ...getTokenLimitParam(REFLECTION_MODEL, 350),
        temperature: 0.4,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "reflection_turn",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                state: { type: "string", enum: ["exploring", "proposal_ready"] },
                reply: { type: "string" },
                memoryProposal: {
                  anyOf: [
                    { type: "null" },
                    {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        title: { type: "string" },
                        summary: { type: "string" },
                        evidence: {
                          type: "array",
                          items: {
                            type: "object",
                            additionalProperties: false,
                            properties: {
                              userMessageId: { type: "string" },
                              excerpt: { type: "string" },
                            },
                            required: ["userMessageId", "excerpt"],
                          },
                        },
                      },
                      required: ["title", "summary", "evidence"],
                    },
                  ],
                },
              },
              required: ["state", "reply", "memoryProposal"],
            },
          },
        },
        messages: [
          {
            role: "system",
            content:
              "You are Pensieve, a memory-elicitation companion. Help the user get a memory or idea into their own words. While exploring, briefly acknowledge what they said and ask exactly one short, focused question about one missing detail: what happened, who was there, what they noticed, what happened before or after, how it felt, or why it matters. Prefer the user's vocabulary. Do not offer menus of answers, ask compound questions, diagnose, use clinical language, infer hidden motives, claim bodily or psychological mechanisms, or give advice unless explicitly asked. Never ask whether to save or turn something into a memory. There is no turn-count trigger. Return state proposal_ready only when the user has supplied (1) an identifiable event, experience, scene, or recurring pattern, (2) specific detail, (3) their own emotion, realization, meaning, or reason it matters, and (4) enough support to write a first-person summary without adding causes or conclusions. Uncertainty such as 'I don't know' or 'maybe' is a reason to keep exploring unless the rest of the transcript independently satisfies every criterion. A proposal must cite one to four exact excerpts from user messages using the message ids in the transcript. Otherwise return exploring with memoryProposal null.",
          },
          {
            role: "user",
            content: `Continue this reflection transcript. Each line begins with a message id:\n\n${safeTranscript}`,
          },
        ],
      },
      { timeout: AI_TIMEOUT_MS }
    )
  );

  return parseReflectionAIOutput(response.choices[0]?.message?.content, normalizedMessages);
}

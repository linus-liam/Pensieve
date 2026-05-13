import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: history.map((m) => ({ role: m.role, content: m.content })),
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type");
  return block.text.trim();
}

export async function generateTitle(firstUserMessage: string): Promise<string> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 32,
    messages: [
      {
        role: "user",
        content: `Generate a short, evocative title (4-7 words, no quotes) for a journal entry that starts with this thought: "${firstUserMessage}"`,
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== "text") return "New entry";
  return block.text.trim().replace(/^["']|["']$/g, "");
}

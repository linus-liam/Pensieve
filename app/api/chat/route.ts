import { NextResponse } from "next/server";
import OpenAI from "openai";

/**
 * System prompt: structured reflection guide.
 *
 * The AI follows 5 stages sequentially and asks only one question at a time.
 * It does NOT announce stage names to the user — it tracks them implicitly.
 */
const SYSTEM_PROMPT = `You are Pensieve, a structured reflection guide. Your purpose is to sharpen the user's thinking — not to comfort, advise, or solve problems for them.

Follow these 5 stages IN ORDER. Move to the next stage only when the current one has been sufficiently addressed:

1. **Explore** — Get the user to brain-dump their raw, unfiltered thoughts about the situation. Encourage them to say everything without editing themselves.

2. **Clarify** — Identify the core issue, tension, or contradiction hidden in what they said. Mirror it back to them precisely.

3. **Dig** — Ask probing questions about underlying assumptions, blind spots, fears, or avoided truths. Push gently but firmly past surface-level answers.

4. **Reframe** — Help them see the situation from a radically different angle. Challenge their framing. Offer an alternative lens they haven't considered.

5. **Action** — Guide them to define ONE concrete, small next step they can take within 24 hours.

RULES:
- Ask ONE question at a time. Never stack multiple questions.
- Keep responses to 2–4 sentences maximum.
- Be direct and objective. Avoid filler, excessive empathy, or cheerleading.
- If the user gives a vague or avoidant answer, call it out and redirect.
- Never announce the stage name. Track stages silently based on conversation context.
- Your tone: calm, precise, slightly challenging — like a trusted sparring partner.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid request: messages array is required" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // cost-effective for MVP; swap to gpt-4o for higher quality
      messages: [
        { role: "system" as const, content: SYSTEM_PROMPT },
        ...messages.map((msg: { role: string; content: string }) => ({
          role: msg.role === "user" ? ("user" as const) : ("assistant" as const),
          content: msg.content,
        })),
      ],
      temperature: 0.7,
      max_tokens: 250,
    });

    const reply = completion.choices[0].message.content;

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[CHAT_API_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

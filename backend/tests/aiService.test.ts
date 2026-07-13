import { beforeEach, describe, expect, it, vi } from "vitest";

const openAIMocks = vi.hoisted(() => ({
  createCompletion: vi.fn(),
}));

vi.mock("openai", () => ({
  default: vi.fn(function OpenAI() {
    return {
      chat: {
        completions: {
          create: openAIMocks.createCompletion,
        },
      },
    };
  }),
}));

describe("aiService acknowledgements", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    openAIMocks.createCompletion.mockReset();
    openAIMocks.createCompletion.mockResolvedValue({
      choices: [
        {
          message: {
            content:
              "That sounds frustrating. Is the harder part the amount of work, or not knowing which work matters most?",
          },
        },
      ],
    });
  });

  it("asks for one grounded detail while avoiding memory-save prompts", async () => {
    const { acknowledgeMemory } = await import("../src/services/aiService.js");

    await acknowledgeMemory("I want to remember how steady today felt.");

    const [payload] = openAIMocks.createCompletion.mock.calls[0] ?? [];
    const systemMessage = payload.messages.find(
      (message: { role: string }) => message.role === "system"
    )?.content;
    const userMessage = payload.messages.find(
      (message: { role: string }) => message.role === "user"
    )?.content;

    expect(systemMessage).toMatch(/do not ask.*save/i);
    expect(systemMessage).toMatch(/do not ask.*keep/i);
    expect(systemMessage).toMatch(/do not ask.*memory/i);
    expect(systemMessage).toMatch(/ask exactly one grounded follow-up question/i);
    expect(systemMessage).not.toMatch(/do not ask a follow-up question/i);
    expect(userMessage).toContain("This entry has already been captured");
    expect(userMessage).toContain("Ask one grounded follow-up question");
  });

  it("falls back when a model still asks whether to save a memory", async () => {
    openAIMocks.createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: "Would you like me to save this as a memory?" } }],
    });
    const { acknowledgeMemory } = await import("../src/services/aiService.js");

    await expect(acknowledgeMemory("That made me feel calmer.")).resolves.toBe(
      "I'm with you in that. What part of this feels most important to understand next?"
    );
  });

  it("falls back when a model does not ask a follow-up question", async () => {
    openAIMocks.createCompletion.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "That sounds exhausting, and I can see why it weighs on you.",
          },
        },
      ],
    });
    const { acknowledgeMemory } = await import("../src/services/aiService.js");

    await expect(
      acknowledgeMemory("I work hard every day but never feel like I make progress.")
    ).resolves.toBe(
      "I'm with you in that. What part of this feels most important to understand next?"
    );
  });
});

describe("aiService reflection turns", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    openAIMocks.createCompletion.mockReset();
  });

  function completion(content: object) {
    return { choices: [{ message: { content: JSON.stringify(content) } }] };
  }

  it("uses gpt-5.4-mini with strict structured outputs", async () => {
    openAIMocks.createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({
        state: "exploring",
        reply: "What happened next?",
        memoryProposal: null,
      }) } }],
    });
    const { continueReflection } = await import("../src/services/aiService.js");

    await continueReflection([
      { id: "user-1", role: "user", content: "I found an old photo." },
    ]);

    const [payload] = openAIMocks.createCompletion.mock.calls[0] ?? [];
    expect(payload.model).toBe("gpt-5.4-mini");
    expect(payload.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "reflection_turn", strict: true },
    });
  });

  it.each(["Tell me more.", "Who was there? What happened next?"])(
    "rejects exploring reply with an invalid question count: %s",
    async (reply) => {
      openAIMocks.createCompletion.mockResolvedValueOnce(
        completion({ state: "exploring", reply, memoryProposal: null })
      );
      const { continueReflection } = await import("../src/services/aiService.js");

      await expect(
        continueReflection([{ id: "user-1", role: "user", content: "I feel off." }])
      ).rejects.toMatchObject({ code: "invalid_ai_response" });
    }
  );

  it("accepts a grounded memory proposal without a turn-count trigger", async () => {
    openAIMocks.createCompletion.mockResolvedValueOnce(
      completion({
        state: "proposal_ready",
        reply: "That sounds like the part worth holding onto.",
        memoryProposal: {
          title: "The Collapsed Tent",
          summary: "I remember Dad laughing when our tent collapsed.",
          evidence: [
            {
              userMessageId: "user-1",
              excerpt: "Dad laughed when our tent collapsed",
            },
          ],
        },
      })
    );
    const { continueReflection } = await import("../src/services/aiService.js");

    await expect(
      continueReflection([
        {
          id: "user-1",
          role: "user",
          content: "Dad laughed when our tent collapsed, and I want to remember how safe that felt.",
        },
      ])
    ).resolves.toEqual({
      state: "proposal_ready",
      reply: "That sounds like the part worth holding onto.",
      memoryProposal: {
        title: "The Collapsed Tent",
        summary: "I remember Dad laughing when our tent collapsed.",
        evidence: [
          {
            userMessageId: "user-1",
            excerpt: "Dad laughed when our tent collapsed",
          },
        ],
      },
    });
  });

  it("rejects proposal evidence that is not in the referenced user message", async () => {
    openAIMocks.createCompletion.mockResolvedValueOnce(
      completion({
        state: "proposal_ready",
        reply: "That sounds worth holding onto.",
        memoryProposal: {
          title: "An Invented Memory",
          summary: "I understood something the user never said.",
          evidence: [{ userMessageId: "user-1", excerpt: "words the user never said" }],
        },
      })
    );
    const { continueReflection } = await import("../src/services/aiService.js");

    await expect(
      continueReflection([{ id: "user-1", role: "user", content: "I found an old photo." }])
    ).rejects.toMatchObject({ code: "invalid_ai_response" });
  });
});

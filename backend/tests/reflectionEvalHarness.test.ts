import { describe, expect, it } from "vitest";
import type { ReflectionTurnResponse } from "../src/types.js";
import { scoreScenario, summarizeRun } from "../evals/reflectionMetrics.js";
import { reflectionScenarios } from "../evals/reflectionScenarios.js";

const exploring = (reply: string): ReflectionTurnResponse => ({
  state: "exploring",
  reply,
  memoryProposal: null,
});

const paused: ReflectionTurnResponse = {
  state: "paused",
  reply: "We can pause here.",
  memoryProposal: null,
};

const proposalTurn: ReflectionTurnResponse = {
  state: "proposal_ready",
  reply: "That sounds worth holding onto.",
  memoryProposal: {
    title: "The collapsed tent",
    summary: "I remember Dad laughing when our tent collapsed.",
    evidence: [
      {
        userMessageId: "user-2",
        excerpt: "Dad laughing",
      },
    ],
  },
};

describe("reflection workflow evaluation metrics", () => {
  it("covers positive, vague, uncertain, and advice-seeking workflows", () => {
    expect(reflectionScenarios).toHaveLength(9);
    expect(reflectionScenarios.filter((scenario) => !scenario.expectation.expectedProposal))
      .toHaveLength(3);
    expect(
      reflectionScenarios
        .filter((scenario) => !scenario.expectation.expectedProposal)
        .every((scenario) => scenario.userTurns.length >= 6)
    ).toBe(true);
  });

  it("measures question counts and the first proposal turn", () => {
    expect(summarizeRun([exploring("Who was there?"), proposalTurn])).toMatchObject({
      turnToFirstProposal: 2,
      questionCounts: [1, 0],
      exploringExactlyOneQuestionRate: 1,
    });
  });

  it("marks a negative scenario failed when any proposal appears", () => {
    expect(
      scoreScenario(
        { expectedProposal: false, minimumTurnsWithoutProposal: 6 },
        summarizeRun([
          exploring("What feels most noticeable?"),
          exploring("When did you first notice it?"),
          proposalTurn,
        ])
      )
    ).toMatchObject({ passed: false, reasons: ["unexpected proposal at turn 3"] });
  });

  it("passes a positive scenario that proposes inside its target window", () => {
    expect(
      scoreScenario(
        { expectedProposal: true, proposalWindow: [2, 6] },
        summarizeRun([exploring("Who was there?"), proposalTurn])
      ).passed
    ).toBe(true);
  });

  it("counts a user-requested pause as a completed non-proposal turn", () => {
    const summary = summarizeRun([
      exploring("What feels most noticeable?"),
      paused,
    ]);

    expect(summary).toMatchObject({
      turnCount: 2,
      turnToFirstProposal: null,
      questionCounts: [1, 0],
      exploringExactlyOneQuestionRate: 1,
    });
    expect(
      scoreScenario(
        { expectedProposal: false, minimumTurnsWithoutProposal: 2 },
        summary
      ).passed
    ).toBe(true);
  });
});

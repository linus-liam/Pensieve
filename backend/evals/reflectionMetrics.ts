import type { ReflectionTurnResponse } from "../src/types.js";

export interface ReflectionRunSummary {
  turnToFirstProposal: number | null;
  proposalCount: number;
  questionCounts: number[];
  exploringExactlyOneQuestionRate: number;
  responseLengths: number[];
  turnCount: number;
}

export type ScenarioExpectation =
  | { expectedProposal: true; proposalWindow: [number, number] }
  | { expectedProposal: false; minimumTurnsWithoutProposal: number };

export interface ScenarioScore {
  passed: boolean;
  reasons: string[];
}

function countQuestions(text: string) {
  return text.match(/\?/g)?.length ?? 0;
}

export function summarizeRun(responses: ReflectionTurnResponse[]): ReflectionRunSummary {
  const proposalTurns = responses
    .map((response, index) => (response.state === "proposal_ready" ? index + 1 : null))
    .filter((turn): turn is number => turn !== null);
  const questionCounts = responses.map((response) => countQuestions(response.reply));
  const exploringTurns = responses
    .map((response, index) => ({ response, questions: questionCounts[index] }))
    .filter(({ response }) => response.state === "exploring");
  const exactlyOneCount = exploringTurns.filter(({ questions }) => questions === 1).length;

  return {
    turnToFirstProposal: proposalTurns[0] ?? null,
    proposalCount: proposalTurns.length,
    questionCounts,
    exploringExactlyOneQuestionRate:
      exploringTurns.length === 0 ? 1 : exactlyOneCount / exploringTurns.length,
    responseLengths: responses.map((response) => response.reply.length),
    turnCount: responses.length,
  };
}

export function scoreScenario(
  expectation: ScenarioExpectation,
  summary: ReflectionRunSummary
): ScenarioScore {
  const reasons: string[] = [];

  if (summary.exploringExactlyOneQuestionRate !== 1) {
    reasons.push("an exploring response did not contain exactly one question");
  }

  if (expectation.expectedProposal) {
    if (summary.turnToFirstProposal === null) {
      reasons.push("no proposal produced");
    } else {
      const [minimum, maximum] = expectation.proposalWindow;
      if (summary.turnToFirstProposal < minimum || summary.turnToFirstProposal > maximum) {
        reasons.push(
          `proposal at turn ${summary.turnToFirstProposal} outside ${minimum}-${maximum}`
        );
      }
    }
  } else if (summary.turnToFirstProposal !== null) {
    reasons.push(`unexpected proposal at turn ${summary.turnToFirstProposal}`);
  } else if (summary.turnCount < expectation.minimumTurnsWithoutProposal) {
    reasons.push(
      `only ${summary.turnCount} turns tested; expected ${expectation.minimumTurnsWithoutProposal}`
    );
  }

  return { passed: reasons.length === 0, reasons };
}

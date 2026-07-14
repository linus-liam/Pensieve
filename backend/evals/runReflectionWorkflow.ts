import "../src/config/env.js";
import type { ReflectionChatMessage, ReflectionTurnResponse } from "../src/types.js";
import { summarizeRun, scoreScenario } from "./reflectionMetrics.js";
import { reflectionScenarios } from "./reflectionScenarios.js";

const repetitions = Math.max(1, Number.parseInt(process.env.EVAL_REPETITIONS ?? "3", 10) || 3);
const model = process.env.AI_REFLECTION_MODEL ?? "gpt-5.4-mini";
const scenarioFilter = new Set(
  (process.env.EVAL_SCENARIOS ?? "").split(",").map((value) => value.trim()).filter(Boolean)
);
const selectedScenarios = scenarioFilter.size
  ? reflectionScenarios.filter((scenario) => scenarioFilter.has(scenario.id))
  : reflectionScenarios;
const { continueReflection } = await import("../src/services/aiService.js");

interface TurnRecord {
  user: string;
  assistant: ReflectionTurnResponse;
}

interface RunRecord {
  scenarioId: string;
  repetition: number;
  passed: boolean;
  reasons: string[];
  summary: ReturnType<typeof summarizeRun>;
  turns: TurnRecord[];
  error?: string;
}

const records: RunRecord[] = [];

for (const scenario of selectedScenarios) {
  for (let repetition = 1; repetition <= repetitions; repetition += 1) {
    const messages: ReflectionChatMessage[] = [
      {
        id: `${scenario.id}-${repetition}-assistant-0`,
        role: "assistant",
        content: "I'm here. What feels worth remembering right now?",
      },
    ];
    const turns: TurnRecord[] = [];
    let error: string | undefined;

    for (let index = 0; index < scenario.userTurns.length; index += 1) {
      const user = scenario.userTurns[index];
      messages.push({
        id: `${scenario.id}-${repetition}-user-${index + 1}`,
        role: "user",
        content: user,
      });

      try {
        const assistant = await continueReflection(messages);
        turns.push({ user, assistant });
        messages.push({
          id: `${scenario.id}-${repetition}-assistant-${index + 1}`,
          role: "assistant",
          content: assistant.reply,
        });
        if (assistant.state === "proposal_ready" && !scenario.continueAfterProposal) break;
      } catch (runError) {
        error = runError instanceof Error ? runError.message : String(runError);
        break;
      }
    }

    const summary = summarizeRun(turns.map((turn) => turn.assistant));
    const score = scoreScenario(scenario.expectation, summary);
    const reasons = error ? [`workflow error: ${error}`, ...score.reasons] : score.reasons;
    records.push({
      scenarioId: scenario.id,
      repetition,
      passed: reasons.length === 0,
      reasons,
      summary,
      turns,
      error,
    });

    console.log(`\n[${scenario.id}] repetition ${repetition}/${repetitions}`);
    for (const [turnIndex, turn] of turns.entries()) {
      console.log(`  User ${turnIndex + 1}: ${turn.user}`);
      console.log(
        `  Pensieve (${turn.assistant.state}): ${turn.assistant.reply}`
      );
      if (turn.assistant.state === "proposal_ready") {
        console.log(`  Proposal: ${turn.assistant.memoryProposal.title}`);
        console.log(`  Summary: ${turn.assistant.memoryProposal.summary}`);
        console.log(
          `  Evidence: ${turn.assistant.memoryProposal.evidence
            .map((item) => `${item.userMessageId}=${JSON.stringify(item.excerpt)}`)
            .join(" | ")}`
        );
      }
    }
    console.log(
      `  Result: ${reasons.length === 0 ? "PASS" : `FAIL (${reasons.join("; ")})`}`
    );
    console.log(
      `  Metrics: proposal=${summary.turnToFirstProposal ?? "none"}, questions=${summary.questionCounts.join(",")}, one-question-rate=${summary.exploringExactlyOneQuestionRate}`
    );
  }
}

const passedRuns = records.filter((record) => record.passed).length;
const negativeRecords = records.filter((record) =>
  reflectionScenarios.find((scenario) => scenario.id === record.scenarioId)?.expectation
    .expectedProposal === false
);
const unexpectedNegativeProposals = negativeRecords.filter(
  (record) => record.summary.turnToFirstProposal !== null
).length;
const positiveRecords = records.filter((record) =>
  reflectionScenarios.find((scenario) => scenario.id === record.scenarioId)?.expectation
    .expectedProposal === true
);
const positiveInWindow = positiveRecords.filter((record) => record.passed).length;

const aggregate = {
  model,
  repetitions,
  scenarios: selectedScenarios.length,
  totalRuns: records.length,
  passedRuns,
  passRate: records.length === 0 ? 0 : passedRuns / records.length,
  negativeProposalRate:
    negativeRecords.length === 0 ? 0 : unexpectedNegativeProposals / negativeRecords.length,
  positiveInWindowRate:
    positiveRecords.length === 0 ? 0 : positiveInWindow / positiveRecords.length,
  tokenUsage: null,
};

console.log("\n=== Aggregate reflection evaluation ===");
console.log(JSON.stringify(aggregate, null, 2));

if (records.some((record) => !record.passed)) process.exitCode = 1;

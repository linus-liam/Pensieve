import "../src/config/env.js";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { createLocalApp } from "../src/localApp.js";
import { createReflectionAI, reflectionPrompt } from "../src/services/reflectionAI.js";
import { createHash } from "node:crypto";
import type { ReflectionSession } from "../src/services/localSessionStore.js";
import { reflectionScenarios } from "./reflectionScenarios.js";

if (process.argv.slice(2).join(" ") !== "--live") {
  console.log("用法：npm run eval:reflection -- --live\n使用当前配置的模型，最多发送 12 次合成对话请求。仅写临时目录；不读取个人记忆。会产生 API 费用。输出保留全文供人工检查，自动检查不能判定对话质量。");
  process.exit(process.argv.length > 2 ? 1 : 0);
}
const ai = createReflectionAI();
if (!ai.configured) {
  console.error("请先在本机配置模型密钥；评估不会读取个人记忆。");
  process.exit(1);
}
const output = await mkdtemp(join(tmpdir(), "pensieve-reflection-eval-"));
const data = join(output, "synthetic-data");
const headers = { "X-Pensieve-Local-Token": randomUUID() };
const app = createLocalApp(data, headers["X-Pensieve-Local-Token"], ai);
const results: unknown[] = [];
let failed = false;
try {
  // At most three independent synthetic sessions run concurrently.
  await Promise.all(reflectionScenarios.map(async scenario => {
    const id = randomUUID();
    const turns: unknown[] = [];
    const checks: { name: string; passed: boolean }[] = [];
    const check = (name: string, passed: boolean) => {
      checks.push({ name, passed });
      if (!passed) failed = true;
    };
    let error: string | undefined;
    try {
      await request(app).post("/api/sessions").set(headers).send({ id }).expect(201);
      for (const [index, turn] of scenario.turns.entries()) {
        const messageId = randomUUID();
        await request(app).post(`/api/sessions/${id}/messages`).set(headers).send({ id: messageId, content: turn.text }).expect(200);
        // No review=true: the model must recognize natural language closure itself.
        const response = await request(app).post(`/api/sessions/${id}/respond`).set(headers).send({ id: randomUUID(), cloudConsent: true });
        if (response.status !== 200) throw new Error(`HTTP ${response.status} (${String(response.body.code ?? "unknown")})`);
        const session = response.body as ReflectionSession;
        const message = session.messages.at(-1)!;
        const draft = session.drafts.find(d => d.id === session.current_draft_id);
        check(`turn-${index + 1}:review-state`, Boolean(draft) === turn.expectReview);
        if (turn.expectReview) check(`turn-${index + 1}:closure-without-question`, !/[?？]/u.test(message.content));
        const questionMarks = (message.content.match(/[?？]/gu) ?? []).length;
        turns.push({ user: turn.text, assistant: message.content, review: draft?.text ?? null, questionMarks, assistantCharacters: message.content.length });
        console.log(`${scenario.id} ${index + 1}/${scenario.turns.length}: ${draft ? "review" : "chat"}, ${message.content.length} chars`);
        // Keep going through a premature review, as a user choosing “continue” would.
        if (draft && index < scenario.turns.length - 1) await request(app).post(`/api/sessions/${id}/continue`).set(headers).expect(200);
      }
      const current = (await request(app).get(`/api/sessions/${id}`).set(headers).expect(200)).body as ReflectionSession;
      check("raw-user-text-preserved", JSON.stringify(current.messages.filter(m => m.role === "user").map(m => m.content)) === JSON.stringify(scenario.turns.map(t => t.text)));
      check("no-memory-before-confirmation", current.memory_revisions.length === 0);
      const finalDraft = current.drafts.find(d => d.id === current.current_draft_id);
      if (finalDraft) {
        check("review-links-all-prior-messages", JSON.stringify(finalDraft.source_message_ids) === JSON.stringify(current.messages.slice(0, -1).map(m => m.id)));
        const edited = finalDraft.text + "\n\n（合成验收：这仍是暂定理解。）";
        await request(app).post(`/api/sessions/${id}/confirm`).set(headers).send({ draftId: finalDraft.id, text: edited }).expect(200);
        const restarted = createLocalApp(data, headers["X-Pensieve-Local-Token"], ai);
        const saved = (await request(restarted).get(`/api/sessions/${id}`).set(headers).expect(200)).body as ReflectionSession;
        check("edited-memory-survives-reopen", saved.status === "completed" && saved.memory_revisions.at(-1)?.raw_input === edited);
        check("ai-draft-preserved", saved.drafts.find(d => d.id === finalDraft.id)?.text === finalDraft.text);
      }
    } catch (failure) {
      failed = true;
      // The app already redacts provider errors; never serialize raw SDK errors/config.
      error = failure instanceof Error ? failure.message : "Evaluation failed";
    }
    results.push({ id: scenario.id, focus: scenario.focus, rubric: scenario.rubric, checks, turns, ...(error ? { error } : {}) });
  }));
  const report = { generatedAt: new Date().toISOString(), model: ai.model, promptSha256: createHash("sha256").update(reflectionPrompt).digest("hex"), synthetic: true, manualReviewRequired: true, automaticChecksPassed: !failed, results };
  const reportPath = join(output, "report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(`Report: ${reportPath}\nAutomatic checks: ${failed ? "FAILED" : "passed"}. 对话质量仍需逐段人工检查。`);
} finally {
  await rm(data, { recursive: true, force: true });
}
process.exitCode = failed ? 1 : 0;

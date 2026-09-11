import { afterEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ create: vi.fn(), options: vi.fn() }));
vi.mock("openai", () => ({ default: class { constructor(options: unknown) { mock.options(options); } chat = { completions: { create: mock.create } }; } }));
import { createReflectionAI } from "../src/services/reflectionAI.js";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
const messages = [{ id: "user", role: "user" as const, content: "合成测试文字", created_at: "2026-09-11" }];
it("requests structured replies without storing completions and retains the full supplied context", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-key");
  mock.create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ message: "测试回复", review: null }) } }] });
  expect(await createReflectionAI().reply(messages, false)).toEqual({ message: "测试回复", review: null });
  const body = mock.create.mock.calls[0][0];
  expect(body.store).toBe(false); expect(body.messages.at(-1)).toEqual({ role: "user", content: "合成测试文字" });
  expect(body.response_format.json_schema.strict).toBe(true);
});
it("does not call the model without a key and rejects malformed or missing reviews safely", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  await expect(createReflectionAI().reply(messages, false)).rejects.toMatchObject({ code: "ai_not_configured" });
  expect(mock.create).not.toHaveBeenCalled();
  vi.stubEnv("OPENAI_API_KEY", "test-only-key");
  mock.create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ message: "回复", review: null }) } }] });
  await expect(createReflectionAI().reply(messages, true)).rejects.toMatchObject({ code: "ai_unavailable" });
});

it("uses an explicit proxy and reports invalid credentials without exposing provider error text", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-key");
  vi.stubEnv("OPENAI_PROXY_URL", "http://127.0.0.1:7897");
  mock.create.mockRejectedValue({ status: 401, code: "invalid_api_key", message: "secret-provider-message" });
  await expect(createReflectionAI().reply(messages, false)).rejects.toMatchObject({ status: 401, code: "invalid_api_key" });
  expect(mock.options.mock.calls[0][0].httpAgent.proxy.hostname).toBe("127.0.0.1");
  await expect(createReflectionAI().reply(messages, false)).rejects.not.toHaveProperty("message", "secret-provider-message");
});
it("distinguishes exhausted quota and network failure", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-key");
  mock.create.mockRejectedValueOnce({ status: 429, code: "insufficient_quota" });
  await expect(createReflectionAI().reply(messages, false)).rejects.toMatchObject({ code: "insufficient_quota" });
  mock.create.mockRejectedValueOnce({ name: "APIConnectionTimeoutError" });
  await expect(createReflectionAI().reply(messages, false)).rejects.toMatchObject({ code: "ai_connection_failed" });
});

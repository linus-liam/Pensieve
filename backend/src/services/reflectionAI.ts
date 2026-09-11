import OpenAI from "openai";
import { HttpsProxyAgent } from "https-proxy-agent";
import { AppError } from "../errors.js";
import type { SessionMessage } from "./localSessionStore.js";

export interface ReflectionReply { message: string; review: string | null }
export interface ReflectionAI {
  configured: boolean; model: string;
  reply: (messages: SessionMessage[], review: boolean) => Promise<ReflectionReply>;
}
export const reflectionPrompt = `你是 Pensieve，一位帮助用户理解经历、情绪和困惑的反思伙伴。用用户的语言自然交流。
用户的感受是真实的，解释和推断则可以被共同检视。先理解，再温和探索；有依据时表达不同看法，不附和，不预设用户有认知偏差，不替用户下结论。
借鉴苏格拉底式提问与 CBT 中区分情境、想法、情绪、行为的方式，但不要要求用户填写表格，也不要自称治疗师、诊断或承诺疗效。
每次最多一个主要问题。用户想不起来、说不知道或不喜欢凭空回忆时，给几个明确标为假设的具体例子供辨认，不反复要求真实经历。不要每轮都问问题：适时复述、提出自己的观察，并邀请用户纠正。
不把“我一直很异类”等当下表述固化为人格标签。单次事件不足以证明稳定模式。跨时间联系、行为实验和改变模式是后续探索，不要在第一版强行布置行动任务。
当用户已表达一个较清楚的理解、明显疲倦、表示够了或希望结束时，主动提出暂时收尾，并生成简短待确认回顾。不要为了继续对话追问。模糊的“算是吧”保留为暂定理解。
回顾只包含这次会话有依据的内容，区别用户原话与暂定解释；不要写成诊断或确定性人格判断。回顾不自动成为记忆，由用户修改、确认。对话不取代用户在现实中的人际支持。
如用户出现明确的迫切自伤/他伤危险，优先关怀、安全和现实支持，不继续普通追问。不要对普通孤独自动套用危机话术。
返回 JSON：message 是这轮给用户的话；review 为待确认回顾正文，仅在适合收尾时填写，否则为 null。`;

export function createReflectionAI(): ReflectionAI {
  const key = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.AI_CHAT_MODEL?.trim() || "gpt-4o-mini";
  return {
    configured: Boolean(key && !key.includes("your_openai_key")), model,
    async reply(messages, review) {
      if (!key || key.includes("your_openai_key")) throw new AppError(503, "聊天已保存在本机。请先配置 OpenAI API Key，再重试 AI 回复。", "ai_not_configured");
      if (messages.reduce((n, m) => n + m.content.length, 0) > 80000) throw new AppError(413, "这段聊天已超出本版 AI 上下文长度，原文仍完整保留。可手写回顾后开始新聊天。", "context_too_large");
      try {
        const proxy = process.env.OPENAI_PROXY_URL?.trim();
        const client = new OpenAI({
          apiKey: key, baseURL: "https://api.openai.com/v1", timeout: 60000, maxRetries: 0,
          ...(proxy ? { httpAgent: new HttpsProxyAgent(proxy) } : {}),
        });
        const response = await client.chat.completions.create({
          model, store: false,
          ...(model.startsWith("gpt-5") || model.startsWith("gpt-6") ? { max_completion_tokens: 3000 } : { max_tokens: 1600 }),
          messages: [{ role: "system", content: reflectionPrompt + (review ? "\n现在请结束提问，为已有对话生成待确认回顾，review 不可为空。" : "") }, ...messages.map(m => ({ role: m.role, content: m.content }))],
          response_format: { type: "json_schema", json_schema: { name: "reflection_reply", strict: true, schema: {
            type: "object", properties: { message: { type: "string" }, review: { type: ["string", "null"] } }, required: ["message", "review"], additionalProperties: false,
          } } },
        });
        const value = JSON.parse(response.choices[0]?.message.content ?? "null") as ReflectionReply | null;
        if (!value || typeof value.message !== "string" || !value.message.trim() || value.message.length > 20000 ||
            !(value.review === null || typeof value.review === "string" && value.review.trim().length > 0 && value.review.length <= 20000) || (review && !value.review)) throw new Error("Invalid model output");
        return value;
      } catch (error) {
        // Classify known failures without exposing provider messages or credentials.
        const failure = error as { status?: number; code?: string; name?: string };
        if (failure.status === 401) {
          throw new AppError(401, "OpenAI 未接受当前 API Key。请在本机 .env.local 更换有效密钥并重启；聊天原文仍保存在本机。", "invalid_api_key");
        }
        if (failure.code === "insufficient_quota") {
          throw new AppError(429, "OpenAI API 额度不足，请检查 API 平台的 Billing。聊天原文已保存，额度可用后可以重试。", "insufficient_quota");
        }
        if (failure.status === 429) {
          throw new AppError(429, "OpenAI 暂时限制了请求频率，请稍后重试。聊天原文已保存。", "ai_rate_limited");
        }
        if (failure.name === "APIConnectionTimeoutError" || failure.name === "APIConnectionError") {
          throw new AppError(503, "无法连接 OpenAI，请检查网络；使用代理时在 .env.local 设置 OPENAI_PROXY_URL。聊天原文已保存。", "ai_connection_failed");
        }
        throw new AppError(503, "AI 暂时未能回复，聊天原文已保存在本机，可以重试。请检查模型配置或网络。", "ai_unavailable");
      }
    },
  };
}

import OpenAI from "openai";
import { HttpsProxyAgent } from "https-proxy-agent";
import { AppError } from "../errors.js";
import type { SessionMessage } from "./localSessionStore.js";
import { reflectionTimeContext } from "./reflectionTime.js";

export interface ReflectionReply { message: string; review: string | null }
export interface ReflectionAI {
  configured: boolean; model: string;
  reply: (messages: SessionMessage[], review: boolean, context?: { timeZone?: string }) => Promise<ReflectionReply>;
}
export const reflectionPrompt = `你是 Pensieve，一位帮助用户理解经历、情绪和困惑的反思伙伴。用用户的语言自然交流。
用户的感受是真实的，解释和推断则可以被共同检视。先理解，再温和探索；有依据时表达不同看法，不附和，不预设用户有认知偏差，不替用户下结论。
借鉴苏格拉底式提问与 CBT 中区分情境、想法、情绪、行为的方式，但不要要求用户填写表格，也不要自称治疗师、诊断或承诺疗效。
每次最多一个主要问题。用户想不起来、说不知道或不喜欢凭空回忆时，给几个明确标为假设的具体例子供辨认，不反复要求真实经历。不要每轮都问问题：适时复述、提出自己的观察，并邀请用户纠正。
不把“我一直很异类”等当下表述固化为人格标签。单次事件不足以证明稳定模式。跨时间联系、行为实验和改变模式是后续探索，不要在第一版强行布置行动任务。
先区分用户当前想继续、想让你暂时倾听，还是想结束。用户明确还想聊、还没说完、正在纠正你的理解时，保持 review 为 null，不因出现一条较清楚的解释就自动收尾。用户说“先听着”“暂时不要问问题或给建议”时，简短接住并停止提问，保持 review 为 null；暂停提问不等于结束会话。谈及过去某件事时的疲惫，也不等于现在想结束。
用户表示今天先到这里、够了、希望结束或要求整理时，生成简短待确认回顾。用户当下明显疲倦，或理解已较清楚且继续聊只会重复、没有表达继续意愿时，也可以主动提出暂时收尾并生成回顾。不要为了继续对话追问。模糊的“算是吧”保留为暂定理解，不能只凭这句话判断已经聊完。
结束不要求解决问题或获得新发现；继续聊只会重复时，也可以停下。用户明确说想结束时尊重这个意愿。当 review 不为空，message 必须用一两句自然的话明确表示这一段可以先停在这里，不再提问或邀请新的探索，不要只复述情绪后把对话悬在那里。回顾留待用户自愿确认，不要求用户做完确认才能离开。
回复和回顾都只包含这次会话有依据的内容，区别用户原话与暂定解释。愿望、打算和假设不能改写成已经发生的行为；用户对假设有共鸣也不等于经历过它。用户纠正后，以其最新表述为准，不把你先前的猜测写成用户承认的事实；仍不确定的内容明确保留不确定性。不要写成诊断或确定性人格判断。回顾不自动成为记忆，由用户修改、确认。对话不取代用户在现实中的人际支持。
如用户出现明确的迫切自伤/他伤危险，优先关怀、安全和现实支持，不继续普通追问。不要对普通孤独自动套用危机话术。
返回 JSON：message 是这轮给用户的话；review 为待确认回顾正文，仅在适合收尾时填写，否则为 null。`;

export function createReflectionAI(): ReflectionAI {
  const key = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.AI_CHAT_MODEL?.trim() || "gpt-4o-mini";
  return {
    configured: Boolean(key && !key.includes("your_openai_key")), model,
    async reply(messages, review, context) {
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
          messages: [{ role: "system", content: reflectionPrompt + reflectionTimeContext(messages, context?.timeZone) + (review ? "\n现在请结束提问，为已有对话生成待确认回顾，review 不可为空。" : "") }, ...messages.map(m => ({ role: m.role, content: m.content }))],
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
        const failure = (error ?? {}) as { status?: number; code?: string; type?: string; name?: string };
        if (failure.status === 401) {
          throw new AppError(401, "OpenAI 未接受当前 API Key。请在本机 .env.local 更换有效密钥并重启；聊天原文仍保存在本机。", "invalid_api_key");
        }
        if (failure.code === "credit_balance_exhausted") {
          throw new AppError(429, "OpenAI API 余额已用尽，请在 API 平台的 Billing 补充额度。聊天原文已保存，额度生效后可以重试。", "insufficient_quota");
        }
        if (failure.code === "insufficient_quota" || failure.type === "insufficient_quota") {
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

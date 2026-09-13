import express from "express";
import helmet from "helmet";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { createReflectionAI, type ReflectionAI } from "./services/reflectionAI.js";
import type { SessionMessage } from "./services/localSessionStore.js";
import { AppError } from "./errors.js";

const cookieName = "pensieve_phone";
const lifetime = 30 * 24 * 60 * 60;
const equal = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

export function createMobileApp(options: { ai?: ReflectionAI; accessCode?: string; sessionSecret?: string; secureCookies?: boolean } = {}) {
  const app = express();
  app.set("query parser", false);
  app.set("trust proxy", 1);
  const ai = options.ai ?? createReflectionAI();
  const code = options.accessCode ?? process.env.PENSIEVE_ACCESS_CODE ?? "";
  const secret = options.sessionSecret ?? process.env.PENSIEVE_SESSION_SECRET ?? "";
  const configured = code.length >= 24 && secret.length >= 32;
  const secure = options.secureCookies ?? process.env.NODE_ENV === "production";
  const sign = (expires: string) => createHmac("sha256", secret).update(`${expires}:${code}`).digest("base64url");
  const authenticated = (req: express.Request) => {
    if (!configured) return false;
    const token = (req.get("Cookie") ?? "").split(";").map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) ?? "";
    const [expires, signature, extra] = token.split(".");
    return !extra && /^\d{10}$/.test(expires ?? "") && Number(expires) > Date.now() / 1000 && typeof signature === "string" && equal(signature, sign(expires));
  };
  const setCookie = (res: express.Response, value: string, age: number) => res.set("Set-Cookie", `${cookieName}=${value}; Path=/api/mobile; Max-Age=${age}; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`);
  app.use(helmet());
  app.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  app.use((req, res, next) => {
    if (req.method !== "GET" && (req.get("X-Pensieve-Client") !== "phone-v1" || req.get("Sec-Fetch-Site") === "cross-site")) {
      res.status(403).json({ error: "请从 Pensieve 页面操作", code: "origin_required" }); return;
    }
    next();
  });
  app.use(express.json({ limit: "512kb" }));
  const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "尝试次数较多，请稍后再试。" } });
  const aiLimit = rateLimit({ windowMs: 60 * 1000, limit: 12, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "请稍等片刻再发送，原文仍在设备上。" } });
  app.get("/api/mobile/status", (req, res) => res.json({ configured: configured && ai.configured, authenticated: authenticated(req), model: ai.model }));
  app.post("/api/mobile/login", loginLimit, (req, res) => {
    if (!configured) { res.status(503).json({ error: "私人试用服务尚未配置完成。" }); return; }
    if (typeof req.body?.code !== "string" || !equal(req.body.code.trim(), code)) { res.status(401).json({ error: "试用口令不正确。" }); return; }
    const expires = String(Math.floor(Date.now() / 1000) + lifetime);
    setCookie(res, `${expires}.${sign(expires)}`, lifetime); res.json({ ok: true });
  });
  app.post("/api/mobile/logout", (_req, res) => { setCookie(res, "", 0); res.json({ ok: true }); });
  app.post("/api/mobile/reply", aiLimit, async (req, res) => {
    if (!authenticated(req)) { res.status(401).json({ error: "请先输入试用口令，连接私人 AI 服务。" }); return; }
    try {
      if (req.body?.cloudConsent !== true) throw new AppError(403, "请先确认开启 AI", "consent_required");
      const messages = req.body.messages as SessionMessage[];
      if (!Array.isArray(messages) || !messages.length || messages.length > 512 || !messages.some(m => m?.role === "user")) throw new AppError(400, "聊天内容无效", "invalid_messages");
      let characters = 0;
      const clean = messages.map(m => {
        if (!m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || !m.content.trim() || m.content.length > 20000 || typeof m.id !== "string" || m.id.length > 100 || typeof m.created_at !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(m.created_at) || !Number.isFinite(Date.parse(m.created_at))) throw new AppError(400, "聊天内容无效", "invalid_messages");
        characters += m.content.length;
        return { id: m.id, role: m.role, content: m.content, created_at: new Date(m.created_at).toISOString() };
      });
      if (characters > 80000) throw new AppError(413, "这段聊天较长，请先手写回顾或开启新聊天。完整原文仍在设备上。", "context_too_large");
      res.json(await ai.reply(clean, req.body.review === true, { timeZone: typeof req.body.timeZone === "string" ? req.body.timeZone : undefined }));
    } catch (error) {
      const known = error instanceof AppError;
      res.status(known ? error.status : 503).json({ error: known && ["consent_required", "invalid_messages", "context_too_large"].includes(error.code) ? error.message : "AI 暂时未能回复。原文仍在当前设备，请稍后重试。", code: known ? error.code : "ai_unavailable" });
    }
  });
  app.use((_req, res) => res.status(404).json({ error: "接口不存在" }));
  // Never log request bodies, chats, provider responses or credentials.
  app.use(((error, _req, res, _next) => res.status(error?.type === "entity.too.large" ? 413 : 400).json({ error: "请求内容无效或过长" })) as express.ErrorRequestHandler);
  return app;
}

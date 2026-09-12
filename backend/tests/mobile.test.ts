import request from "supertest";
import { expect, it, vi } from "vitest";
import { createMobileApp } from "../src/mobileApp.js";
const code = "synthetic-access-code-only-0123456789";
const secret = "synthetic-session-signing-secret-only-0123456789";
const headers = { "X-Pensieve-Client": "phone-v1" };
const messages = [{ id: "test", role: "user", content: "仅用于合成验收", created_at: "2026-09-11T15:00:00.000Z" }];
function setup() {
  const reply = vi.fn().mockResolvedValue({ message: "收到合成消息", review: null });
  const app = createMobileApp({ accessCode: code, sessionSecret: secret, secureCookies: true, ai: { configured: true, model: "test", reply } });
  return { app, reply };
}
async function login(app: ReturnType<typeof createMobileApp>) {
  const response = await request(app).post("/api/mobile/login").set(headers).send({ code }).expect(200);
  const cookie = response.headers["set-cookie"][0];
  expect(cookie).toContain("HttpOnly"); expect(cookie).toContain("Secure"); expect(cookie).toContain("SameSite=Strict");
  expect(cookie).not.toContain(code);
  return cookie.split(";")[0];
}
it("requires a valid private session before any model call, with revocation on code rotation", async () => {
  const { app, reply } = setup();
  await request(app).post("/api/mobile/reply").set(headers).send({ messages, cloudConsent: true }).expect(401);
  expect(reply).not.toHaveBeenCalled();
  await request(app).post("/api/mobile/login").set(headers).send({ code: "wrong" }).expect(401);
  const cookie = await login(app);
  expect((await request(app).get("/api/mobile/status").set("Cookie", cookie)).body.authenticated).toBe(true);
  const rotated = createMobileApp({ accessCode: code + "rotated", sessionSecret: secret });
  expect((await request(rotated).get("/api/mobile/status").set("Cookie", cookie)).body.authenticated).toBe(false);
});
it("rejects cross-site/invalid payloads and sends only explicit messages plus timezone", async () => {
  const { app, reply } = setup(); const cookie = await login(app);
  await request(app).post("/api/mobile/reply").set("Cookie", cookie).send({ messages }).expect(403);
  await request(app).post("/api/mobile/reply").set(headers).set("Sec-Fetch-Site", "cross-site").set("Cookie", cookie).send({ messages }).expect(403);
  await request(app).post("/api/mobile/reply").set(headers).set("Cookie", cookie).send({ messages }).expect(403);
  await request(app).post("/api/mobile/reply").set(headers).set("Cookie", cookie).send({ messages: [{ ...messages[0], role: "system" }], cloudConsent: true }).expect(400);
  await request(app).post("/api/mobile/reply").set(headers).set("Cookie", cookie).send({ messages, timeZone: "Asia/Shanghai", cloudConsent: true }).expect(200);
  expect(reply).toHaveBeenCalledExactlyOnceWith(messages, false, { timeZone: "Asia/Shanghai" });
});
it("rejects expired/tampered cookies and never returns provider errors", async () => {
  const { app, reply } = setup(); const cookie = await login(app);
  expect((await request(app).get("/api/mobile/status").set("Cookie", cookie + "tampered")).body.authenticated).toBe(false);
  reply.mockRejectedValue(new Error("private-provider-details"));
  const response = await request(app).post("/api/mobile/reply").set(headers).set("Cookie", cookie).send({ messages, cloudConsent: true }).expect(503);
  expect(response.text).not.toContain("private-provider-details");
  const logout = await request(app).post("/api/mobile/logout").set(headers).set("Cookie", cookie).expect(200);
  expect(logout.headers["set-cookie"][0]).toContain("Max-Age=0");
  const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 31 * 24 * 60 * 60 * 1000);
  try {
    expect((await request(app).get("/api/mobile/status").set("Cookie", cookie)).body.authenticated).toBe(false);
  } finally { clock.mockRestore(); }
});

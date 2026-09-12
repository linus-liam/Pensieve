import type { SessionMessage } from "./localSessionStore.js";

export function reflectionTimeContext(messages: SessionMessage[], timeZone?: string, now = new Date()) {
  let zone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  try { new Intl.DateTimeFormat("en", { timeZone: zone }).format(now); }
  catch { zone = "UTC"; }
  const format = (date: Date) => new Intl.DateTimeFormat("zh-CN", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date);
  const times = messages.map((message, index) => {
    const date = new Date(message.created_at);
    return Number.isFinite(date.getTime()) ? `第 ${index + 1} 条（${message.role}）：${format(date)}；UTC ${date.toISOString()}` : `第 ${index + 1} 条：记录时间未知`;
  });
  return `\n时间背景：当前 UTC 时间 ${now.toISOString()}；显示时区 ${zone}；当前当地时间 ${format(now)}。\n以下时间是消息记录时间，不是所述事情的发生时间。理解“今天、昨天、明天”时，以说出这句话的记录日期为参照；跨日继续聊天时不要把以前的“今天”当成现在。未说明的事件日期保持未知，不根据时间擅自推断情绪、作息或所在地。无需在每次回复中报时。\n${times.join("\n")}`;
}

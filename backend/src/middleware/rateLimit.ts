import rateLimit from "express-rate-limit";

const skipInTest = () => process.env.NODE_ENV === "test";

export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT ?? 300),
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { error: "too many requests, please try again later", code: "rate_limited" },
});

export const memoryWriteRateLimit = rateLimit({
  windowMs: Number(process.env.MEMORY_WRITE_RATE_LIMIT_WINDOW_MS ?? 10 * 60 * 1000),
  limit: Number(process.env.MEMORY_WRITE_RATE_LIMIT ?? 10),
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { error: "too many memory saves, please try again later", code: "rate_limited" },
});

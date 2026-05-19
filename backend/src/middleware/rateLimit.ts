import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const skipInTest = () => process.env.NODE_ENV === "test";

export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT ?? 300),
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
});

export const messageRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.MESSAGE_RATE_LIMIT ?? 20),
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT ?? 10),
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  // Throttle per IP + email so credential stuffing / enumeration is bounded
  // without locking out everyone behind a shared NAT.
  keyGenerator: (req) => {
    const email =
      typeof req.body?.email === "string" ? req.body.email.toLowerCase() : "";
    return `${ipKeyGenerator(req.ip ?? "")}:${email}`;
  },
  message: { error: "too many attempts, please try again later", code: "rate_limited" },
});

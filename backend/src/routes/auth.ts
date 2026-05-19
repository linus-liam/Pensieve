import { Router } from "express";
import type { Request } from "express";
import { AppError } from "../errors.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authRateLimit } from "../middleware/rateLimit.js";
import { createUser, verifyUser } from "../services/authService.js";
import { normalizeEmail, requirePassword } from "../utils/validation.js";

const router = Router();

function regenerateSession(req: Request) {
  return new Promise<void>((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

router.post(
  "/register",
  authRateLimit,
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = requirePassword(req.body?.password);
    const user = await createUser(email, password);

    await regenerateSession(req);
    req.session.user = user;
    res.status(201).json({ user });
  })
);

router.post(
  "/login",
  authRateLimit,
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = requirePassword(req.body?.password);
    const user = await verifyUser(email, password);

    if (!user) {
      throw new AppError(401, "invalid email or password", "invalid_credentials");
    }

    await regenerateSession(req);
    req.session.user = user;
    res.json({ user });
  })
);

router.post("/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("pensieve.sid");
    res.status(204).end();
  });
});

router.get("/me", (req, res) => {
  res.json({ user: req.session.user ?? null });
});

export default router;

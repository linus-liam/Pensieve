import type { Request, RequestHandler } from "express";
import { AppError } from "../errors.js";
import type { AuthenticatedUser } from "../services/supabaseAuthService.js";
import { getAuthenticatedUser } from "../services/supabaseAuthService.js";

declare module "express-serve-static-core" {
  interface Request {
    authUser?: AuthenticatedUser;
  }
}

function getBearerToken(req: Request) {
  const authorization = req.get("authorization");
  if (!authorization) {
    throw new AppError(401, "authentication required", "auth_required");
  }

  const [scheme, token, extra] = authorization.split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token || extra) {
    throw new AppError(401, "invalid authorization header", "invalid_authorization_header");
  }

  return token;
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    req.authUser = await getAuthenticatedUser(getBearerToken(req));
    next();
  } catch (error) {
    next(error);
  }
};

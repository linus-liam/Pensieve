import type { ErrorRequestHandler } from "express";
import { AppError, isPgError } from "../errors.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }

  if (isPgError(error)) {
    if (error.code === "22P02") {
      return res.status(400).json({ error: "invalid identifier", code: "invalid_uuid" });
    }

    if (error.code === "23503") {
      return res.status(404).json({ error: "not found", code: "not_found" });
    }

    if (error.code === "23505") {
      return res.status(409).json({ error: "already exists", code: "conflict" });
    }
  }

  console.error(error);
  return res.status(500).json({ error: "internal server error", code: "internal_error" });
};

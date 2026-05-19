import { AppError } from "../errors.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requireUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new AppError(400, `${field} must be a valid UUID`, "invalid_uuid");
  }
  return value;
}

export function requireText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new AppError(400, `${field} is required`, "invalid_input");
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new AppError(400, `${field} is required`, "invalid_input");
  }

  if (trimmed.length > maxLength) {
    throw new AppError(
      413,
      `${field} must be ${maxLength} characters or fewer`,
      "input_too_large"
    );
  }

  return trimmed;
}

export function normalizeEmail(value: unknown): string {
  const email = requireText(value, "email", 254).toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new AppError(400, "email must be valid", "invalid_email");
  }
  return email;
}

export function requirePassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 8) {
    throw new AppError(400, "password must be at least 8 characters", "weak_password");
  }

  if (value.length > 128) {
    throw new AppError(413, "password must be 128 characters or fewer", "input_too_large");
  }

  return value;
}

export function parsePagination(query: Record<string, unknown>) {
  const limit = Math.min(Math.max(Number(query.limit ?? 50) || 50, 1), 100);
  const offset = Math.max(Number(query.offset ?? 0) || 0, 0);

  return { limit, offset };
}

import bcrypt from "bcryptjs";
import { pool } from "../db/client.js";
import { AppError, isPgError } from "../errors.js";
import type { AuthenticatedUser, User } from "../types.js";

const PASSWORD_COST = Number(process.env.PASSWORD_COST ?? 12);

// Used to spend equivalent bcrypt time when an email is not found, so login
// timing does not reveal whether an account exists.
const DUMMY_HASH = bcrypt.hashSync("password-not-a-real-account", PASSWORD_COST);

function toAuthenticatedUser(user: Pick<User, "id" | "email">): AuthenticatedUser {
  return { id: user.id, email: user.email };
}

export async function createUser(email: string, password: string): Promise<AuthenticatedUser> {
  const passwordHash = await bcrypt.hash(password, PASSWORD_COST);

  try {
    const { rows } = await pool.query<User>(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, password_hash, created_at`,
      [email, passwordHash]
    );

    return toAuthenticatedUser(rows[0]);
  } catch (error) {
    if (isPgError(error) && error.code === "23505") {
      throw new AppError(409, "email already registered", "email_taken");
    }
    throw error;
  }
}

export async function verifyUser(
  email: string,
  password: string
): Promise<AuthenticatedUser | null> {
  const { rows } = await pool.query<User>(
    "SELECT id, email, password_hash, created_at FROM users WHERE email = $1",
    [email]
  );

  const user = rows[0];
  const matches = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  return user && matches ? toAuthenticatedUser(user) : null;
}

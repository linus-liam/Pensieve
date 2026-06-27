import { getEnvValue } from "../config/env.js";
import pg from "pg";

const { Pool } = pg;

const isProduction = process.env.NODE_ENV === "production";
const connectionString = getEnvValue("POSTGRES_URL", "DATABASE_URL", "POSTGRES_PRISMA_URL");

if (isProduction && !connectionString) {
  const required = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"].filter((key) => !getEnvValue(key));

  if (required.length > 0) {
    throw new Error(`Missing required database env vars: ${required.join(", ")}`);
  }
}

// SSL is opt-in: a plain local/CI Postgres (e.g. the test container) speaks
// no TLS, so forcing it there breaks the connection. Enable it for
// production, an explicit DB_SSL=true, or a connection string that itself
// asks for TLS (sslmode=require / ssl=true) or targets managed Postgres.
function connectionStringWantsSsl(url: string): boolean {
  return (
    /[?&](sslmode=require|sslmode=verify|ssl=true)/i.test(url) ||
    /\.(neon\.tech|vercel-storage\.com|pooler\.supabase\.com|supabase\.co)/i.test(url)
  );
}

const useSsl =
  isProduction ||
  getEnvValue("DB_SSL") === "true" ||
  (!!connectionString && connectionStringWantsSsl(connectionString));

export const pool = connectionString
  ? new Pool({
      connectionString,
      // Managed Postgres (Neon/Vercel) terminates TLS with a cert chain pg
      // can't verify by default; relax unless explicitly told otherwise.
      ssl: useSsl
        ? { rejectUnauthorized: getEnvValue("DB_SSL_REJECT_UNAUTHORIZED") === "true" }
        : undefined,
    })
  : new Pool({
      host: getEnvValue("DB_HOST") ?? "localhost",
      port: Number(getEnvValue("DB_PORT") ?? 5432),
      database: getEnvValue("DB_NAME") ?? "pensieve",
      user: getEnvValue("DB_USER") ?? "pensieve",
      password: getEnvValue("DB_PASSWORD") ?? (isProduction ? undefined : "pensieve"),
    });

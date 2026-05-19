import pg from "pg";

const { Pool } = pg;

const isProduction = process.env.NODE_ENV === "production";
const connectionString =
  process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL;

if (isProduction && !connectionString) {
  const required = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"].filter(
    (key) => !process.env[key]
  );

  if (required.length > 0) {
    throw new Error(`Missing required database env vars: ${required.join(", ")}`);
  }
}

export const pool = connectionString
  ? new Pool({
      connectionString,
      // Managed Postgres (Neon/Vercel) terminates TLS with a cert chain pg
      // can't verify by default; relax unless explicitly told otherwise.
      ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true" },
    })
  : new Pool({
      host: process.env.DB_HOST ?? "localhost",
      port: Number(process.env.DB_PORT ?? 5432),
      database: process.env.DB_NAME ?? "pensieve",
      user: process.env.DB_USER ?? "pensieve",
      password: process.env.DB_PASSWORD ?? (isProduction ? undefined : "pensieve"),
    });

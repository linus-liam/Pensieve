import pg from "pg";

const { Pool } = pg;

const isProduction = process.env.NODE_ENV === "production";
const databaseUrl = process.env.DATABASE_URL;

if (isProduction && !databaseUrl) {
  const required = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"].filter(
    (key) => !process.env[key]
  );

  if (required.length > 0) {
    throw new Error(`Missing required database env vars: ${required.join(", ")}`);
  }
}

export const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl:
        process.env.DB_SSL === "true" || isProduction
          ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" }
          : undefined,
    })
  : new Pool({
      host: process.env.DB_HOST ?? "localhost",
      port: Number(process.env.DB_PORT ?? 5432),
      database: process.env.DB_NAME ?? "pensieve",
      user: process.env.DB_USER ?? "pensieve",
      password: process.env.DB_PASSWORD ?? (isProduction ? undefined : "pensieve"),
    });

import pg from "pg";

const { Pool } = pg;

const connectionString =
  process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL;

export const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      host: process.env.DB_HOST ?? "localhost",
      port: Number(process.env.DB_PORT ?? 5432),
      database: process.env.DB_NAME ?? "pensieve",
      user: process.env.DB_USER ?? "pensieve",
      password: process.env.DB_PASSWORD ?? "pensieve",
    });

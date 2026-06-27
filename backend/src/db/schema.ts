// Single source of truth for the database schema.
//
// Inlined as a string (rather than read from a .sql file) so the serverless
// bundle never needs filesystem access at runtime. `ensureSchema()` runs this
// on the first API request, so a freshly provisioned database (e.g. a new
// Supabase project) builds its full schema automatically — no separate migrate
// step required on Vercel. Every statement is idempotent.
export const schemaSql = `CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS memory_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  raw_input   TEXT NOT NULL,
  ai_summary  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT memory_entries_raw_input_not_blank CHECK (length(trim(raw_input)) > 0),
  CONSTRAINT memory_entries_ai_summary_not_blank CHECK (length(trim(ai_summary)) > 0)
);

ALTER TABLE memory_entries
  ADD COLUMN IF NOT EXISTS user_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'memory_entries_user_id_required'
  ) THEN
    ALTER TABLE memory_entries
      ADD CONSTRAINT memory_entries_user_id_required CHECK (user_id IS NOT NULL) NOT VALID;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS memory_entries_created_idx
  ON memory_entries(created_at DESC);

CREATE INDEX IF NOT EXISTS memory_entries_user_created_idx
  ON memory_entries(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION update_memory_entry_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS memory_entries_update_timestamp ON memory_entries;
CREATE TRIGGER memory_entries_update_timestamp
  BEFORE UPDATE ON memory_entries
  FOR EACH ROW EXECUTE FUNCTION update_memory_entry_timestamp();`;

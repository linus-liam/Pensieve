CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS memory_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_input   TEXT NOT NULL,
  ai_summary  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT memory_entries_raw_input_not_blank CHECK (length(trim(raw_input)) > 0),
  CONSTRAINT memory_entries_ai_summary_not_blank CHECK (length(trim(ai_summary)) > 0)
);

CREATE INDEX IF NOT EXISTS memory_entries_created_idx
  ON memory_entries(created_at DESC);

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
  FOR EACH ROW EXECUTE FUNCTION update_memory_entry_timestamp();

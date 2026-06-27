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

CREATE INDEX IF NOT EXISTS memory_entries_user_created_idx
  ON memory_entries(user_id, created_at DESC);

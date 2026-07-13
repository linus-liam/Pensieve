CREATE TABLE IF NOT EXISTS reflection_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  title       TEXT NOT NULL DEFAULT 'Untitled reflection',
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reflection_sessions_title_not_blank CHECK (length(trim(title)) > 0),
  CONSTRAINT reflection_sessions_status_valid CHECK (status IN ('active', 'completed', 'archived'))
);

CREATE UNIQUE INDEX IF NOT EXISTS reflection_sessions_one_active_per_user
  ON reflection_sessions(user_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS reflection_sessions_user_updated_idx
  ON reflection_sessions(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS reflection_messages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID NOT NULL REFERENCES reflection_sessions(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL,
  client_message_id     UUID,
  reply_to_message_id   UUID REFERENCES reflection_messages(id) ON DELETE SET NULL,
  role                  TEXT NOT NULL,
  content               TEXT NOT NULL,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reflection_messages_role_valid CHECK (role IN ('user', 'assistant')),
  CONSTRAINT reflection_messages_content_not_blank CHECK (length(trim(content)) > 0)
);

ALTER TABLE reflection_messages
  ADD COLUMN IF NOT EXISTS client_message_id UUID;

ALTER TABLE reflection_messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES reflection_messages(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS reflection_messages_client_id_idx
  ON reflection_messages(session_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS reflection_messages_session_created_idx
  ON reflection_messages(session_id, created_at ASC, id ASC);

ALTER TABLE memory_entries
  ADD COLUMN IF NOT EXISTS title TEXT;

UPDATE memory_entries
SET title = left(ai_summary, 120)
WHERE title IS NULL OR length(trim(title)) = 0;

ALTER TABLE memory_entries
  ALTER COLUMN title SET DEFAULT 'Untitled reflection';

ALTER TABLE memory_entries
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES reflection_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS memory_entries_session_idx
  ON memory_entries(session_id);

CREATE OR REPLACE FUNCTION update_reflection_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reflection_sessions_update_timestamp ON reflection_sessions;
CREATE TRIGGER reflection_sessions_update_timestamp
  BEFORE UPDATE ON reflection_sessions
  FOR EACH ROW EXECUTE FUNCTION update_reflection_session_timestamp();

ALTER TABLE memory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflection_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflection_messages ENABLE ROW LEVEL SECURITY;

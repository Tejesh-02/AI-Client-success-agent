-- Post-resolution feedback: thumbs up/down + optional comment per conversation.
CREATE TABLE IF NOT EXISTS conversation_feedback (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS conversation_feedback_conversation_uq ON conversation_feedback(conversation_id);
CREATE INDEX IF NOT EXISTS conversation_feedback_company_idx ON conversation_feedback(company_id);

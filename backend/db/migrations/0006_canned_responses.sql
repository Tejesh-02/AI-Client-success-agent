-- Canned responses: templates for ticket reply or chat, optionally by issue type.
CREATE TABLE IF NOT EXISTS canned_responses (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  issue_type_id TEXT REFERENCES issue_types(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS canned_responses_company_idx ON canned_responses(company_id);
CREATE INDEX IF NOT EXISTS canned_responses_issue_type_idx ON canned_responses(issue_type_id);

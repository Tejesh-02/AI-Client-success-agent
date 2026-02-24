-- 0012_add_ticket_issue_type.sql
-- Add issue_type_id to tickets table to enable per-issue-type email routing and SLA.

BEGIN;

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS issue_type_id TEXT REFERENCES issue_types(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tickets_issue_type_idx ON tickets(issue_type_id);

COMMIT;

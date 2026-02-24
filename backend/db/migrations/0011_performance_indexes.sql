-- 0011_performance_indexes.sql
-- Add missing composite indexes for high-frequency query patterns.
-- All indexes are created with IF NOT EXISTS to be safe for re-runs.

BEGIN;

-- ── messages ─────────────────────────────────────────────────────────────────
-- Needed for analytics queries that filter messages by role within a company.
CREATE INDEX IF NOT EXISTS messages_company_role_idx
  ON messages(company_id, role);

-- Partial index for AI messages with low confidence scores (knowledge gap queries).
CREATE INDEX IF NOT EXISTS messages_ai_low_confidence_idx
  ON messages(company_id, conversation_id, confidence_score)
  WHERE role = 'ai' AND confidence_score IS NOT NULL;

-- ── tickets ──────────────────────────────────────────────────────────────────
-- Needed for the dashboard filters: company + status + severity + assigned_to.
CREATE INDEX IF NOT EXISTS tickets_company_status_severity_idx
  ON tickets(company_id, status, severity);

CREATE INDEX IF NOT EXISTS tickets_company_assigned_status_idx
  ON tickets(company_id, assigned_to, status)
  WHERE assigned_to IS NOT NULL;

-- Index for SLA due-date queries (find overdue tickets).
CREATE INDEX IF NOT EXISTS tickets_sla_due_idx
  ON tickets(company_id, sla_due_at)
  WHERE sla_due_at IS NOT NULL;

-- ── conversations ─────────────────────────────────────────────────────────────
-- Needed for filtering conversations by company + status + sentiment.
CREATE INDEX IF NOT EXISTS conversations_company_status_sentiment_idx
  ON conversations(company_id, status, sentiment);

-- Needed for sorting conversations by last_message_at (default dashboard order).
CREATE INDEX IF NOT EXISTS conversations_company_last_message_idx
  ON conversations(company_id, last_message_at DESC);

-- ── customer_sessions ────────────────────────────────────────────────────────
-- Composite index for session lookup: token_hash + expires_at (used in verifyToken).
-- Note: Cannot use WHERE expires_at > NOW() — NOW() is not IMMUTABLE.
CREATE INDEX IF NOT EXISTS customer_sessions_token_expires_idx
  ON customer_sessions(token_hash, expires_at);

-- ── audit_logs ───────────────────────────────────────────────────────────────
-- Needed for audit log queries filtered by actor.
-- Note: column was renamed from user_id to actor_id in migration 0010.
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx
  ON audit_logs(company_id, actor_id);

COMMIT;

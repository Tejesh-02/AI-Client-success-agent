-- 0010_rls_and_schema_fixes.sql
-- 1. Rename audit_logs.user_id to actor_id for naming consistency
-- 2. Add unique constraint on tickets(company_id, reference_number)
-- 3. Enable RLS on all tenant-scoped tables with service-role bypass policy

BEGIN;

-- ── 1. Rename audit_logs.user_id → actor_id ─────────────────────────────────
-- The TypeScript model uses `actorId` and the service writes to `user_id`.
-- Renaming the column makes the schema self-documenting and removes the implicit mapping.
-- Idempotent: only runs if user_id still exists (e.g. first run).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE audit_logs RENAME COLUMN user_id TO actor_id;
  END IF;
END $$;

-- ── 2. Unique constraint on ticket reference numbers per company ──────────────
-- Prevents duplicate reference numbers for tickets within the same company.
CREATE UNIQUE INDEX IF NOT EXISTS tickets_company_reference_uq
  ON tickets(company_id, reference_number);

-- ── 3. Enable Row Level Security ─────────────────────────────────────────────
-- The backend uses the service_role key which bypasses RLS by default.
-- Enabling RLS here adds a defense-in-depth layer: even if service role is used
-- for reads, direct DB access via anon/authenticated keys is blocked without
-- an explicit policy grant.

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Service role bypass: all service_role operations pass through unrestricted.
-- This is the policy that allows the backend to function normally.
-- IMPORTANT: These policies use TO service_role which means only the service_role
-- can read/write. Anon and authenticated users cannot access any table directly.
-- Idempotent: DROP IF EXISTS before CREATE so re-runs succeed.

DROP POLICY IF EXISTS companies_service_role ON companies;
CREATE POLICY companies_service_role ON companies TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS users_service_role ON users;
CREATE POLICY users_service_role ON users TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS clients_service_role ON clients;
CREATE POLICY clients_service_role ON clients TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS conversations_service_role ON conversations;
CREATE POLICY conversations_service_role ON conversations TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS messages_service_role ON messages;
CREATE POLICY messages_service_role ON messages TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS tickets_service_role ON tickets;
CREATE POLICY tickets_service_role ON tickets TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS ticket_comments_service_role ON ticket_comments;
CREATE POLICY ticket_comments_service_role ON ticket_comments TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS customer_sessions_service_role ON customer_sessions;
CREATE POLICY customer_sessions_service_role ON customer_sessions TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS ticket_notifications_service_role ON ticket_notifications;
CREATE POLICY ticket_notifications_service_role ON ticket_notifications TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS audit_logs_service_role ON audit_logs;
CREATE POLICY audit_logs_service_role ON audit_logs TO service_role USING (true) WITH CHECK (true);

COMMIT;

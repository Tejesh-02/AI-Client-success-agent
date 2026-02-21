-- 0001_split_architecture.sql
-- Supabase/Postgres schema for hosted customer chat + internal dashboard auth.

BEGIN;

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  support_email TEXT,
  emergency_email TEXT,
  notification_cc JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_profile_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS companies_slug_uq ON companies(slug);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'agent')),
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_company_email_uq ON users(company_id, email);
CREATE INDEX IF NOT EXISTS users_company_role_idx ON users(company_id, role);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS clients_company_email_uq ON clients(company_id, email);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'handed_off')),
  sentiment TEXT NOT NULL DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'negative', 'frustrated')),
  channel TEXT NOT NULL DEFAULT 'hosted_chat',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  agent_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  priority_snapshot TEXT CHECK (priority_snapshot IN ('low', 'moderate', 'important', 'critical', 'emergency'))
);

CREATE INDEX IF NOT EXISTS conversations_company_idx ON conversations(company_id);
CREATE INDEX IF NOT EXISTS conversations_client_idx ON conversations(client_id);
CREATE INDEX IF NOT EXISTS conversations_agent_idx ON conversations(agent_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('ai', 'client', 'agent')),
  content TEXT NOT NULL,
  confidence_score DOUBLE PRECISION,
  kb_article_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_provider TEXT,
  model_name TEXT,
  token_usage INT,
  latency_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_company_conversation_idx ON messages(company_id, conversation_id);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'awaiting_client', 'resolved', 'closed')),
  severity TEXT NOT NULL DEFAULT 'moderate' CHECK (severity IN ('low', 'moderate', 'important', 'critical', 'emergency')),
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  reference_number TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tickets_company_idx ON tickets(company_id);
CREATE INDEX IF NOT EXISTS tickets_assignee_idx ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS tickets_status_severity_idx ON tickets(status, severity);

CREATE TABLE IF NOT EXISTS ticket_comments (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mentioned_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ticket_comments_ticket_idx ON ticket_comments(ticket_id);

CREATE TABLE IF NOT EXISTS customer_sessions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customer_sessions_company_idx ON customer_sessions(company_id);
CREATE INDEX IF NOT EXISTS customer_sessions_client_idx ON customer_sessions(client_id);
CREATE INDEX IF NOT EXISTS customer_sessions_token_idx ON customer_sessions(token_hash);
CREATE INDEX IF NOT EXISTS customer_sessions_expires_idx ON customer_sessions(expires_at);

CREATE TABLE IF NOT EXISTS ticket_notifications (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  recipient_to TEXT NOT NULL,
  recipient_cc JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ticket_notifications_ticket_idx ON ticket_notifications(ticket_id);
CREATE INDEX IF NOT EXISTS ticket_notifications_company_idx ON ticket_notifications(company_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'internal_user' CHECK (actor_type IN ('internal_user', 'customer_session', 'system')),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_company_idx ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx ON audit_logs(resource_type, resource_id);

-- Legacy compatibility: if old installations used `importance`, map values into `severity`.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'importance'
  ) THEN
    EXECUTE $stmt$
      UPDATE tickets
      SET severity = CASE
        WHEN severity IS NOT NULL THEN severity
        WHEN importance = 'critical' THEN 'critical'
        WHEN importance = 'high' THEN 'important'
        WHEN importance = 'medium' THEN 'moderate'
        WHEN importance = 'low' THEN 'low'
        ELSE 'moderate'
      END
    $stmt$;
  END IF;
END $$;

COMMIT;
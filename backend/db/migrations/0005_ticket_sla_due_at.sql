-- SLA due timestamp for tickets (optional; when set, dashboard can show countdown).
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS tickets_sla_due_at_idx ON tickets(sla_due_at) WHERE sla_due_at IS NOT NULL;

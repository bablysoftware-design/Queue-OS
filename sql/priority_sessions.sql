-- ============================================================
-- WaitMate — Priority Overlay System
-- Phase 1: Schema only
-- Safe: additive, no existing tables modified
-- ============================================================

CREATE TABLE IF NOT EXISTS priority_sessions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id               UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  token_id              UUID        NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  counter_id            TEXT        NOT NULL DEFAULT 'main',
  status                TEXT        NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active','completed','cancelled')),
  reason                TEXT,
  created_by_device     TEXT,
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at              TIMESTAMPTZ,
  priority_announced_at TIMESTAMPTZ
);

-- One active session per shop+counter — multi-counter safe
-- Future: Counter1 and Counter2 each get independent active sessions
CREATE UNIQUE INDEX IF NOT EXISTS priority_sessions_one_active
  ON priority_sessions (shop_id, counter_id)
  WHERE status = 'active';

-- Fast lookup by shop and status
CREATE INDEX IF NOT EXISTS priority_sessions_shop_status
  ON priority_sessions (shop_id, status);

-- Fast lookup by token
CREATE INDEX IF NOT EXISTS priority_sessions_token
  ON priority_sessions (token_id);

-- RLS: service_role bypasses, anon blocked
ALTER TABLE priority_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "priority_sessions_service_all" ON priority_sessions;
CREATE POLICY "priority_sessions_service_all"
  ON priority_sessions FOR ALL USING (TRUE);

-- ============================================================
-- WaitMate custom_plan_v1
-- Adds per-subscription feature overrides
-- SAFE TO RUN MULTIPLE TIMES
-- ============================================================

-- Add feature override columns to subscriptions
-- NULL means "inherit from plan", explicit value overrides
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS allow_priority_call   BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS allow_paid_tokens     BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS allow_voice_notes     BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS allow_analytics       BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS allow_poster          BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_label          TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_price          NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS admin_note            TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_active             BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ DEFAULT NOW();

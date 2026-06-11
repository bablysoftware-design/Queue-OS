-- ============================================================
-- WaitMate features_v3 — Plan gating, profiles, reviews
-- Safe: additive only, no existing data modified
-- ============================================================

-- Add feature flags to plans table
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS allow_priority_call   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_paid_tokens     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_voice_notes     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_analytics       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_poster          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_devices           INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS display_name          TEXT,
  ADD COLUMN IF NOT EXISTS description           TEXT;

-- Update plan features
UPDATE plans SET
  allow_priority_call = false,
  allow_paid_tokens   = false,
  allow_voice_notes   = false,
  allow_analytics     = false,
  allow_poster        = false,
  max_devices         = 1,
  display_name        = 'Free Trial',
  description         = '30-day free trial — core queue management'
WHERE name = 'free';

UPDATE plans SET
  allow_priority_call = true,
  allow_paid_tokens   = true,
  allow_voice_notes   = true,
  allow_analytics     = true,
  allow_poster        = true,
  max_devices         = 3,
  display_name        = 'Basic',
  description         = 'For small businesses — up to 300 tokens/day'
WHERE name = 'basic';

UPDATE plans SET
  allow_priority_call = true,
  allow_paid_tokens   = true,
  allow_voice_notes   = true,
  allow_analytics     = true,
  allow_poster        = true,
  max_devices         = -1,
  display_name        = 'Pro',
  description         = 'For large operations — unlimited tokens'
WHERE name = 'pro';

-- Update token limits
UPDATE plans SET max_tokens_per_day = 300  WHERE name = 'basic';
UPDATE plans SET max_tokens_per_day = 9999 WHERE name = 'pro';
UPDATE plans SET max_queue_size     = 150  WHERE name = 'basic';
UPDATE plans SET max_queue_size     = 9999 WHERE name = 'pro';

-- Business profile fields
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS description     TEXT,
  ADD COLUMN IF NOT EXISTS opening_hours   TEXT,
  ADD COLUMN IF NOT EXISTS logo_url        TEXT,
  ADD COLUMN IF NOT EXISTS address         TEXT;

-- Customer reviews
CREATE TABLE IF NOT EXISTS reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  token_id     UUID REFERENCES tokens(id) ON DELETE SET NULL,
  rating       INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  customer_phone TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reviews_shop ON reviews(shop_id);

-- Upgrade requests (businesses requesting plan upgrade)
CREATE TABLE IF NOT EXISTS upgrade_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  requested_plan  TEXT NOT NULL,
  payment_method  TEXT,
  payment_ref     TEXT,
  screenshot_url  TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected')),
  amount_paid     NUMERIC(10,2),
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_shop   ON upgrade_requests(shop_id);
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_status ON upgrade_requests(status);

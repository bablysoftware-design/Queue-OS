-- ============================================================
-- PATCH 3 — Add missing table definitions
-- Safe to run on production: all statements are idempotent
-- Run in Supabase SQL Editor
-- ============================================================

-- ── Step 1: payment_requests ─────────────────────────────────
-- Defined in features_v1.sql but absent from base schema.sql
-- If table already exists, CREATE IF NOT EXISTS is a no-op

CREATE TABLE IF NOT EXISTS payment_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_name  TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  amount         INTEGER NOT NULL DEFAULT 0,
  screenshot_url TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','rejected')),
  token_id       UUID REFERENCES tokens(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at    TIMESTAMPTZ
);

-- Index for Worker's primary query pattern: shop_id + status
CREATE INDEX IF NOT EXISTS idx_payment_requests_shop_status
  ON payment_requests(shop_id, status);

-- ── Step 2: push_subscriptions ───────────────────────────────
-- Defined in push_notifications.sql but absent from base schema.sql

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id   UUID NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  shop_id    UUID NOT NULL REFERENCES shops(id)  ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(token_id)
);

CREATE INDEX IF NOT EXISTS idx_push_token_id ON push_subscriptions(token_id);
CREATE INDEX IF NOT EXISTS idx_push_shop_id  ON push_subscriptions(shop_id);

-- ── Step 3: app_settings ─────────────────────────────────────
-- Defined in ensure_functions.sql but absent from base schema.sql

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default rows (ON CONFLICT = no-op if already seeded)
INSERT INTO app_settings (key, value) VALUES
  ('support_whatsapp', ''),
  ('support_email',    ''),
  ('support_message',  'Need help? Contact us!')
ON CONFLICT (key) DO NOTHING;

-- ── Step 4: shop_registrations ───────────────────────────────
-- Defined in migrations.sql with minimal columns.
-- Extended in features_v2.sql (token_mode) but token_price
-- was never added despite Worker inserting it. Fix both.

CREATE TABLE IF NOT EXISTS shop_registrations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  owner_phone TEXT NOT NULL,
  category    TEXT,
  area        TEXT,
  pin         TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  token_mode  TEXT DEFAULT 'free',
  token_price INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure token_mode exists (added by features_v2 but may be missing on some installs)
ALTER TABLE shop_registrations
  ADD COLUMN IF NOT EXISTS token_mode  TEXT    DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS token_price INTEGER DEFAULT 0;

-- Index for Worker dedup check: owner_phone + status
CREATE INDEX IF NOT EXISTS idx_shop_registrations_phone
  ON shop_registrations(owner_phone, status);

-- ── Step 5: tokens — ensure all extended columns exist ───────
-- These are added across migrations/ensure_functions/push_notifications
-- Consolidated here so a fresh install gets them all at once

ALTER TABLE tokens
  ADD COLUMN IF NOT EXISTS customer_name        TEXT,
  ADD COLUMN IF NOT EXISTS completed_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shop_closed_notified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS grace_started_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notified_position    INT     DEFAULT 0;

-- ── Step 6: shopkeepers — ensure pin_hash column exists ──────
ALTER TABLE shopkeepers
  ADD COLUMN IF NOT EXISTS pin_hash    TEXT,
  ADD COLUMN IF NOT EXISTS pin_changed_at TIMESTAMPTZ;

-- ── Verify ───────────────────────────────────────────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'payment_requests',
    'push_subscriptions',
    'app_settings',
    'shop_registrations'
  )
ORDER BY table_name;
-- Expected: 4 rows

-- ── PATCH 8: shop_scans table ────────────────────────────────
-- One row per meaningful customer scan/visit event.
-- Time-series: daily/weekly/monthly aggregated at query time.
-- Foundation for ranking, social proof, and discovery signals.

CREATE TABLE IF NOT EXISTS shop_scans (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  source     TEXT DEFAULT 'direct', -- 'qr', 'link', 'direct'
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index supports: shop totals, time-window queries, area aggregates
CREATE INDEX IF NOT EXISTS idx_shop_scans_shop_time
  ON shop_scans(shop_id, scanned_at DESC);

-- For platform-wide analytics (area/category discovery)
CREATE INDEX IF NOT EXISTS idx_shop_scans_time
  ON shop_scans(scanned_at DESC);

-- Convenience RPC for dashboard stats (avoids O(n) scan in Worker)
CREATE OR REPLACE FUNCTION get_shop_scan_counts(p_shop_id UUID)
RETURNS JSON LANGUAGE SQL AS $$
  SELECT json_build_object(
    'today',    COUNT(*) FILTER (WHERE scanned_at >= CURRENT_DATE),
    'week',     COUNT(*) FILTER (WHERE scanned_at >= CURRENT_DATE - 7),
    'total',    COUNT(*)
  )
  FROM shop_scans
  WHERE shop_id = p_shop_id;
$$;

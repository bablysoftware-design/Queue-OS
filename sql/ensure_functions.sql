-- ============================================================
-- ENSURE ALL FUNCTIONS EXIST — Run in Supabase SQL Editor
-- Safe to run multiple times (CREATE OR REPLACE)
-- ============================================================

-- Atomic token increment (prevents race condition)
CREATE OR REPLACE FUNCTION increment_token(p_shop_id UUID)
RETURNS INT AS $$
DECLARE v_next INT;
BEGIN
  UPDATE shops SET current_token = current_token + 1
  WHERE id = p_shop_id RETURNING current_token INTO v_next;
  RETURN v_next;
END;
$$ LANGUAGE plpgsql;

-- Public shops listing with live queue counts (single query, no N+1)
CREATE OR REPLACE FUNCTION get_public_shops(
  p_area TEXT DEFAULT NULL, p_category TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50, p_offset INT DEFAULT 0
) RETURNS JSON AS $$
DECLARE v_result JSON;
BEGIN
  SELECT json_build_object(
    'shops', COALESCE(json_agg(row_to_json(d) ORDER BY d.is_open DESC, d.name ASC), '[]'::json),
    'total', COUNT(*) OVER(),
    'areas', (SELECT json_agg(DISTINCT area ORDER BY area) FROM shops WHERE is_active=TRUE AND area IS NOT NULL)
  ) INTO v_result
  FROM (
    SELECT s.id, s.name, s.category, s.area, s.address, s.description,
           s.opening_time, s.closing_time, s.is_open, s.is_active,
           s.current_token, s.avg_service_time_mins,
           COUNT(t.id) FILTER (WHERE t.status='waiting') AS queue_length,
           MAX(t.token_number) FILTER (WHERE t.status='called') AS current_serving,
           COUNT(t.id) FILTER (WHERE t.status='waiting') * s.avg_service_time_mins AS estimated_wait,
           (COUNT(t.id) FILTER (WHERE t.status='waiting')) >= 15 AS is_busy
    FROM shops s
    LEFT JOIN tokens t ON t.shop_id=s.id AND t.created_at::DATE=CURRENT_DATE
    WHERE s.is_active=TRUE
      AND (p_area IS NULL OR s.area ILIKE '%'||p_area||'%')
      AND (p_category IS NULL OR s.category=p_category)
    GROUP BY s.id LIMIT p_limit OFFSET p_offset
  ) d;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Today's stats for a shop
CREATE OR REPLACE FUNCTION get_shop_stats(p_shop_id UUID)
RETURNS JSON AS $$
DECLARE today DATE := CURRENT_DATE;
BEGIN
  RETURN json_build_object(
    'served',  (SELECT COUNT(*) FROM tokens WHERE shop_id=p_shop_id AND status='completed' AND created_at::DATE=today),
    'no_show', (SELECT COUNT(*) FROM tokens WHERE shop_id=p_shop_id AND status='no_show'   AND created_at::DATE=today),
    'waiting', (SELECT COUNT(*) FROM tokens WHERE shop_id=p_shop_id AND status='waiting'   AND created_at::DATE=today),
    'total',   (SELECT COUNT(*) FROM tokens WHERE shop_id=p_shop_id AND created_at::DATE=today)
  );
END;
$$ LANGUAGE plpgsql;

-- Reset daily tokens (midnight cron)
CREATE OR REPLACE FUNCTION reset_daily_tokens() RETURNS void AS $$
BEGIN
  UPDATE tokens SET status='expired' WHERE status='waiting' AND created_at < CURRENT_DATE::TIMESTAMPTZ;
  UPDATE tokens SET status='completed', completed_at=NOW() WHERE status='called' AND created_at < CURRENT_DATE::TIMESTAMPTZ;
  UPDATE shops SET current_token=0 WHERE is_active=TRUE;
END;
$$ LANGUAGE plpgsql;

-- Count customer tokens today (duplicate prevention)
CREATE OR REPLACE FUNCTION count_customer_tokens_today(p_shop_id UUID, p_customer_phone TEXT)
RETURNS INT AS $$
  SELECT COUNT(*)::INT FROM tokens
  WHERE shop_id=p_shop_id AND customer_phone=p_customer_phone
    AND created_at::DATE=CURRENT_DATE AND status NOT IN ('cancelled','expired');
$$ LANGUAGE sql;

-- Ensure required columns exist
ALTER TABLE shops  ADD COLUMN IF NOT EXISTS opening_time TEXT DEFAULT '09:00';
ALTER TABLE shops  ADD COLUMN IF NOT EXISTS closing_time TEXT DEFAULT '21:00';
ALTER TABLE shops  ADD COLUMN IF NOT EXISTS description  TEXT;
ALTER TABLE shops  ADD COLUMN IF NOT EXISTS address      TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS customer_name        TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS completed_at         TIMESTAMPTZ;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS cancelled_at         TIMESTAMPTZ;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS shop_closed_notified BOOLEAN DEFAULT FALSE;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_tokens_shop_status
  ON tokens(shop_id, status) WHERE status IN ('waiting','called');

SELECT 'All functions created successfully ✅' AS result;

-- ── Add token_mode and token_price columns if missing ──────────
ALTER TABLE shops ADD COLUMN IF NOT EXISTS token_mode  TEXT NOT NULL DEFAULT 'free';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS token_price INT  NOT NULL DEFAULT 0;

-- Add screenshot_url column to payment_requests if missing
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS screenshot_url TEXT;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS token_id UUID;

-- ── App settings table (contact support etc) ──────────────
CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default values
INSERT INTO app_settings (key, value)
VALUES
  ('support_whatsapp', ''),
  ('support_email',    ''),
  ('support_message',  'Need help? Contact us!')
ON CONFLICT (key) DO NOTHING;

SELECT 'Settings table ready ✅' AS result;

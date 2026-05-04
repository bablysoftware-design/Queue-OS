-- ============================================================
-- SAF QUEUE — Features v2: Locations, Categories, Status
-- Run in Supabase SQL Editor
-- Safe: all IF NOT EXISTS
-- ============================================================

-- ─── 1. Extend shops with country, city, status ─────────────
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS city    TEXT,
  ADD COLUMN IF NOT EXISTS status  TEXT NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending','approved','rejected','suspended'));

-- Existing shops are already live → keep them approved
UPDATE shops SET status = 'approved' WHERE status IS NULL OR status = '';

-- ─── 2. Extend shop_registrations with country, city, token_mode ──
ALTER TABLE shop_registrations
  ADD COLUMN IF NOT EXISTS country    TEXT,
  ADD COLUMN IF NOT EXISTS city       TEXT,
  ADD COLUMN IF NOT EXISTS token_mode TEXT DEFAULT 'free';

-- ─── 3. locations table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  city    TEXT NOT NULL,
  area    TEXT,
  UNIQUE(country, city, area)
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_locations" ON locations;
CREATE POLICY "public_read_locations" ON locations FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "public_insert_locations" ON locations;
CREATE POLICY "public_insert_locations" ON locations FOR INSERT WITH CHECK (TRUE);

-- Seed Pakistan cities
INSERT INTO locations (country, city, area) VALUES
  ('Pakistan','Islamabad',NULL),
  ('Pakistan','Rawalpindi',NULL),
  ('Pakistan','Lahore',NULL),
  ('Pakistan','Karachi',NULL),
  ('Pakistan','Peshawar',NULL),
  ('Pakistan','Quetta',NULL),
  ('Pakistan','Multan',NULL),
  ('Pakistan','Faisalabad',NULL),
  ('Pakistan','Sialkot',NULL),
  ('Pakistan','Gujranwala',NULL)
ON CONFLICT DO NOTHING;

-- ─── 4. categories table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT '🏪'
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_categories" ON categories;
CREATE POLICY "public_read_categories" ON categories FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "public_insert_categories" ON categories;
CREATE POLICY "public_insert_categories" ON categories FOR INSERT WITH CHECK (TRUE);

INSERT INTO categories (name, icon) VALUES
  ('barber',   '✂️'),
  ('clinic',   '🏥'),
  ('pharmacy', '💊'),
  ('bank',     '🏦'),
  ('govt',     '🏛️'),
  ('salon',    '💅'),
  ('lab',      '🔬'),
  ('dentist',  '🦷'),
  ('vet',      '🐾'),
  ('other',    '🏪')
ON CONFLICT DO NOTHING;

-- ─── 5. Filter approved shops only in public RPC ─────────────
CREATE OR REPLACE FUNCTION get_public_shops(
  p_area     TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_limit    INT  DEFAULT 50,
  p_offset   INT  DEFAULT 0,
  p_country  TEXT DEFAULT NULL,
  p_city     TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result JSON;
BEGIN
  SELECT json_build_object(
    'shops', COALESCE(json_agg(shop_data ORDER BY is_open DESC, queue_length ASC), '[]'::json),
    'total', COUNT(*) OVER(),
    'areas', (SELECT COALESCE(json_agg(DISTINCT area ORDER BY area), '[]'::json) FROM shops
              WHERE is_active=TRUE AND status='approved' AND area IS NOT NULL)
  )
  INTO v_result
  FROM (
    SELECT s.id, s.name, s.slug, s.category, s.area, s.city, s.country,
           s.address, s.description, s.opening_time, s.closing_time,
           s.is_open, s.is_active, s.current_token, s.avg_service_time_mins,
           s.token_mode, s.token_price,
           COUNT(t.id) FILTER (WHERE t.status='waiting') AS queue_length,
           MAX(t.token_number) FILTER (WHERE t.status='called') AS current_serving,
           COUNT(t.id) FILTER (WHERE t.status='waiting') * s.avg_service_time_mins AS estimated_wait,
           (COUNT(t.id) FILTER (WHERE t.status='waiting')) >= 15 AS is_busy
    FROM shops s
    LEFT JOIN tokens t ON t.shop_id=s.id AND t.created_at::DATE=CURRENT_DATE
    WHERE s.is_active=TRUE
      AND s.status='approved'
      AND (p_area     IS NULL OR s.area    ILIKE '%'||p_area||'%')
      AND (p_category IS NULL OR s.category=p_category)
      AND (p_country  IS NULL OR s.country ILIKE '%'||p_country||'%')
      AND (p_city     IS NULL OR s.city    ILIKE '%'||p_city||'%')
    GROUP BY s.id
    LIMIT p_limit OFFSET p_offset
  ) shop_data;
  RETURN COALESCE(v_result, '{"shops":[],"total":0,"areas":[]}'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_shops(TEXT,TEXT,INT,INT,TEXT,TEXT) TO anon, authenticated;

-- ─── 6. RLS: shop_registrations public can insert ────────────
ALTER TABLE shop_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_insert_registrations" ON shop_registrations;
CREATE POLICY "public_insert_registrations"
  ON shop_registrations FOR INSERT WITH CHECK (TRUE);
DROP POLICY IF EXISTS "admin_read_registrations" ON shop_registrations;
CREATE POLICY "admin_read_registrations"
  ON shop_registrations FOR ALL USING (TRUE);

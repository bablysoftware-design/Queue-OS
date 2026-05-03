-- ============================================================
-- SAF QUEUE — Features v1: Slug, Token Mode, Paid Token
-- Run in Supabase SQL Editor
-- ============================================================

-- ─── 1. Add slug, token_mode, token_price to shops ───────────
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS slug        TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS token_mode  TEXT NOT NULL DEFAULT 'free' CHECK (token_mode IN ('free','paid')),
  ADD COLUMN IF NOT EXISTS token_price INTEGER NOT NULL DEFAULT 0;

-- ─── 2. Generate slugs for existing shops ────────────────────
CREATE OR REPLACE FUNCTION slugify(input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result TEXT;
BEGIN
  result := lower(trim(input));
  result := regexp_replace(result, '[^a-z0-9\s-]', '', 'g');
  result := regexp_replace(result, '\s+', '-', 'g');
  result := regexp_replace(result, '-+', '-', 'g');
  result := trim(result, '-');
  RETURN result;
END;
$$;

-- Auto-assign slugs to shops that don't have one
DO $$
DECLARE
  r RECORD;
  base_slug TEXT;
  final_slug TEXT;
  counter INT;
BEGIN
  FOR r IN SELECT id, name FROM shops WHERE slug IS NULL LOOP
    base_slug := slugify(r.name);
    final_slug := base_slug;
    counter    := 1;
    WHILE EXISTS (SELECT 1 FROM shops WHERE slug = final_slug AND id != r.id) LOOP
      final_slug := base_slug || '-' || counter;
      counter := counter + 1;
    END LOOP;
    UPDATE shops SET slug = final_slug WHERE id = r.id;
  END LOOP;
END;
$$;

-- ─── 3. Auto-generate slug on INSERT ─────────────────────────
CREATE OR REPLACE FUNCTION auto_slugify_shop()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug  TEXT;
  final_slug TEXT;
  counter    INT := 1;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug  := slugify(NEW.name);
    final_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM shops WHERE slug = final_slug AND id != NEW.id) LOOP
      final_slug := base_slug || '-' || counter;
      counter := counter + 1;
    END LOOP;
    NEW.slug := final_slug;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_slugify_shop ON shops;
CREATE TRIGGER trg_auto_slugify_shop
  BEFORE INSERT OR UPDATE OF name ON shops
  FOR EACH ROW EXECUTE FUNCTION auto_slugify_shop();

-- ─── 4. payment_requests table (for paid token approval) ─────
CREATE TABLE IF NOT EXISTS payment_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  amount       INTEGER NOT NULL,
  screenshot_url TEXT,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  token_id     UUID REFERENCES tokens(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at  TIMESTAMPTZ
);

ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_payment_requests" ON payment_requests;
CREATE POLICY "admin_full_payment_requests"
  ON payment_requests FOR ALL USING (TRUE);

-- ─── 5. Update get_public_shops RPC to include slug ──────────
CREATE OR REPLACE FUNCTION get_public_shops(
  p_area     TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_limit    INT  DEFAULT 50,
  p_offset   INT  DEFAULT 0
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
    'areas', (SELECT COALESCE(json_agg(DISTINCT area ORDER BY area), '[]'::json) FROM shops WHERE is_active = TRUE AND area IS NOT NULL)
  )
  INTO v_result
  FROM (
    SELECT s.id, s.name, s.slug, s.category, s.area, s.address, s.description,
           s.opening_time, s.closing_time, s.is_open, s.is_active, s.current_token,
           s.avg_service_time_mins, s.token_mode, s.token_price,
           COUNT(t.id) FILTER (WHERE t.status='waiting') AS queue_length,
           MAX(t.token_number) FILTER (WHERE t.status='called') AS current_serving,
           COUNT(t.id) FILTER (WHERE t.status='waiting') * s.avg_service_time_mins AS estimated_wait,
           (COUNT(t.id) FILTER (WHERE t.status='waiting')) >= 15 AS is_busy
    FROM shops s
    LEFT JOIN tokens t ON t.shop_id = s.id AND t.created_at::DATE = CURRENT_DATE
    WHERE s.is_active = TRUE
      AND (p_area IS NULL OR s.area ILIKE '%' || p_area || '%')
      AND (p_category IS NULL OR s.category = p_category)
    GROUP BY s.id
    LIMIT p_limit OFFSET p_offset
  ) shop_data;
  RETURN COALESCE(v_result, '{"shops":[],"total":0,"areas":[]}'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_shops(TEXT, TEXT, INT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION slugify(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auto_slugify_shop() TO anon, authenticated;

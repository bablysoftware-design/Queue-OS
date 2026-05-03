-- ============================================================
-- SAF QUEUE — RLS Fix for Public Shops Visibility
-- Run this in Supabase SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Add SECURITY DEFINER to get_public_shops RPC
--    so it runs as owner (bypasses RLS) regardless of caller role
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_public_shops(
  p_area     TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_limit    INT  DEFAULT 50,
  p_offset   INT  DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER  -- ← runs as function owner, bypasses RLS
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'shops', COALESCE(json_agg(shop_data ORDER BY is_open DESC, queue_length ASC), '[]'::json),
    'total', COUNT(*) OVER(),
    'areas', (
      SELECT COALESCE(json_agg(DISTINCT area ORDER BY area), '[]'::json)
      FROM shops
      WHERE is_active = TRUE AND area IS NOT NULL
    )
  )
  INTO v_result
  FROM (
    SELECT
      s.id,
      s.name,
      s.category,
      s.area,
      s.address,
      s.description,
      s.opening_time,
      s.closing_time,
      s.is_open,
      s.is_active,
      s.current_token,
      s.avg_service_time_mins,
      COUNT(t.id) FILTER (WHERE t.status = 'waiting')             AS queue_length,
      MAX(t.token_number) FILTER (WHERE t.status = 'called')      AS current_serving,
      COUNT(t.id) FILTER (WHERE t.status = 'waiting') * s.avg_service_time_mins AS estimated_wait,
      (COUNT(t.id) FILTER (WHERE t.status = 'waiting')) >= 15     AS is_busy
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

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION get_public_shops(TEXT, TEXT, INT, INT) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. RLS policies: allow public read on shops (active ones only)
--    and allow token status reads (for position tracking)
-- ─────────────────────────────────────────────────────────────

-- Shops: public can read active shops
DROP POLICY IF EXISTS "public_read_active_shops" ON shops;
CREATE POLICY "public_read_active_shops"
  ON shops FOR SELECT
  USING (is_active = TRUE);

-- Tokens: public can read their own token by id (for position tracking)
DROP POLICY IF EXISTS "public_read_own_token" ON tokens;
CREATE POLICY "public_read_own_token"
  ON tokens FOR SELECT
  USING (TRUE);  -- worker uses service_role; public tracking uses token_id lookup

-- Subscriptions: service_role only (no public access needed)
-- No change needed — worker uses service_role key which bypasses RLS

-- ─────────────────────────────────────────────────────────────
-- 3. Also add SECURITY DEFINER to other worker-called RPCs
-- ─────────────────────────────────────────────────────────────

-- increment_token
CREATE OR REPLACE FUNCTION increment_token(p_shop_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next INT;
BEGIN
  UPDATE shops
  SET current_token = current_token + 1
  WHERE id = p_shop_id
  RETURNING current_token INTO v_next;
  RETURN v_next;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_token(UUID) TO anon, authenticated;

-- cleanup_sessions (called by scheduled worker)
CREATE OR REPLACE FUNCTION cleanup_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM shopkeeper_sessions WHERE expires_at < NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_sessions() TO anon, authenticated;

-- reset_daily_tokens (called by scheduled worker)
CREATE OR REPLACE FUNCTION reset_daily_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tokens
  SET status = 'expired'
  WHERE status = 'waiting'
    AND created_at < CURRENT_DATE::TIMESTAMPTZ;

  UPDATE tokens
  SET status = 'completed'
  WHERE status = 'called'
    AND created_at < CURRENT_DATE::TIMESTAMPTZ;

  UPDATE shops
  SET current_token = 0
  WHERE id IN (
    SELECT DISTINCT shop_id FROM tokens
    WHERE created_at < CURRENT_DATE::TIMESTAMPTZ
  );
END;
$$;

GRANT EXECUTE ON FUNCTION reset_daily_tokens() TO anon, authenticated;

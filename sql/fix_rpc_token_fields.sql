-- ─────────────────────────────────────────────────────────────
-- Fix: update get_public_shops RPC to include token_mode,
-- token_price, country, city columns
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────

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
    'areas', (SELECT COALESCE(json_agg(DISTINCT area ORDER BY area), '[]'::json)
              FROM shops WHERE is_active = TRUE AND area IS NOT NULL)
  )
  INTO v_result
  FROM (
    SELECT s.id, s.name, s.slug, s.category, s.area, s.address, s.description,
           s.opening_time, s.closing_time, s.is_open, s.is_active, s.current_token,
           s.avg_service_time_mins,
           s.token_mode,
           s.token_price,
           s.country,
           s.city,
           COUNT(t.id) FILTER (WHERE t.status='waiting') AS queue_length,
           MAX(t.token_number) FILTER (WHERE t.status='called') AS current_serving,
           COUNT(t.id) FILTER (WHERE t.status='waiting') * s.avg_service_time_mins AS estimated_wait,
           (COUNT(t.id) FILTER (WHERE t.status='waiting')) >= 15 AS is_busy
    FROM shops s
    LEFT JOIN tokens t ON t.shop_id = s.id AND t.created_at::DATE = CURRENT_DATE
    WHERE s.is_active = TRUE
      AND (p_area     IS NULL OR s.area     ILIKE '%' || p_area     || '%')
      AND (p_category IS NULL OR s.category = p_category)
      AND (p_country  IS NULL OR s.country  ILIKE '%' || p_country  || '%')
      AND (p_city     IS NULL OR s.city     ILIKE '%' || p_city     || '%')
    GROUP BY s.id
    LIMIT p_limit OFFSET p_offset
  ) shop_data;
  RETURN COALESCE(v_result, '{"shops":[],"total":0,"areas":[]}'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_shops(TEXT, TEXT, INT, INT, TEXT, TEXT) TO anon, authenticated;

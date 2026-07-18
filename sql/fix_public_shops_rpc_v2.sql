-- ============================================================
-- fix_public_shops_rpc_v2.sql
-- Fixes customer directory showing only ~32 of 128 businesses.
--
-- ROOT CAUSES:
-- 1. WHERE s.is_active=TRUE excluded all unclaimed businesses
--    (imported with is_active=false) — the whole point of
--    unclaimed listings is that they appear in the directory
-- 2. AND s.status='approved' — shops table has no status column,
--    this condition was silently broken
-- 3. p_limit DEFAULT 50 capped at 100 in worker — not enough
--    for growing directories
--
-- FIX: Include unclaimed shops (is_claimed=false) in results.
--      They show in directory with "Unclaimed" badge and a
--      "Claim This Business" CTA instead of "Get Token".
--      Active claimed shops show normally with live queue stats.
--      Increased default limit to 200.
--
-- SAFE TO RUN MULTIPLE TIMES (CREATE OR REPLACE)
-- ============================================================

CREATE OR REPLACE FUNCTION get_public_shops(
  p_area     TEXT    DEFAULT NULL,
  p_category TEXT    DEFAULT NULL,
  p_limit    INT     DEFAULT 200,
  p_offset   INT     DEFAULT 0,
  p_country  TEXT    DEFAULT NULL,
  p_city     TEXT    DEFAULT NULL,
  p_search   TEXT    DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_result JSON;
BEGIN
  SELECT json_build_object(
    'shops', COALESCE(json_agg(shop_data ORDER BY
      -- Active claimed shops first, then unclaimed
      (is_active AND is_claimed) DESC,
      is_open DESC,
      queue_length ASC,
      name ASC
    ), '[]'::json),
    'total', COUNT(*) OVER(),
    'areas', (
      SELECT COALESCE(json_agg(DISTINCT area ORDER BY area), '[]'::json)
      FROM shops
      WHERE (is_active = TRUE OR is_claimed = FALSE)
        AND area IS NOT NULL
    )
  )
  INTO v_result
  FROM (
    SELECT
      s.id, s.name, s.slug, s.category, s.area, s.city, s.country,
      s.address, s.description, s.opening_hours,
      s.is_open, s.is_active,
      COALESCE(s.is_claimed, TRUE) AS is_claimed,
      s.current_token, s.avg_service_time_mins,
      s.token_mode, s.token_price,
      -- Never expose full phone in public directory
      CASE
        WHEN s.owner_phone IS NULL THEN NULL
        WHEN s.owner_phone LIKE 'unclaimed-%' THEN NULL
        ELSE '****' || RIGHT(s.owner_phone, 4)
      END AS owner_phone,
      COALESCE(COUNT(t.id) FILTER (WHERE t.status='waiting'), 0) AS queue_length,
      MAX(t.token_number) FILTER (WHERE t.status='called') AS current_serving,
      COALESCE(COUNT(t.id) FILTER (WHERE t.status='waiting'), 0)
        * COALESCE(s.avg_service_time_mins, 10) AS estimated_wait,
      COALESCE(COUNT(t.id) FILTER (WHERE t.status='waiting'), 0) >= 15 AS is_busy
    FROM shops s
    LEFT JOIN tokens t
      ON t.shop_id = s.id
      AND t.created_at::DATE = CURRENT_DATE
    WHERE
      -- Include: active claimed shops OR unclaimed listings
      (s.is_active = TRUE OR COALESCE(s.is_claimed, TRUE) = FALSE)
      -- Filters
      AND (p_area     IS NULL OR s.area     ILIKE '%' || p_area     || '%')
      AND (p_category IS NULL OR s.category = p_category)
      AND (p_country  IS NULL OR s.country  ILIKE '%' || p_country  || '%')
      AND (p_city     IS NULL OR s.city     ILIKE '%' || p_city     || '%')
      AND (p_search   IS NULL OR s.name     ILIKE '%' || p_search   || '%'
                               OR s.area    ILIKE '%' || p_search   || '%'
                               OR s.city    ILIKE '%' || p_search   || '%')
    GROUP BY s.id
    LIMIT  p_limit
    OFFSET p_offset
  ) AS shop_data;

  RETURN v_result;
END;
$$;

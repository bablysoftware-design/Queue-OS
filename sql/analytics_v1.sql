-- ============================================================
-- Analytics Sprint 3 — Enhanced shop stats
-- Run in Supabase SQL Editor
-- Safe: CREATE OR REPLACE only, no destructive changes
-- ============================================================

CREATE OR REPLACE FUNCTION get_shop_analytics(p_shop_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today     DATE := CURRENT_DATE;
  week_ago  DATE := CURRENT_DATE - INTERVAL '7 days';
  month_ago DATE := CURRENT_DATE - INTERVAL '30 days';
BEGIN
  RETURN json_build_object(

    -- Today
    'today', json_build_object(
      'served',   (SELECT COUNT(*) FROM tokens WHERE shop_id=p_shop_id AND status='completed' AND created_at::DATE=today),
      'no_show',  (SELECT COUNT(*) FROM tokens WHERE shop_id=p_shop_id AND status='no_show'   AND created_at::DATE=today),
      'waiting',  (SELECT COUNT(*) FROM tokens WHERE shop_id=p_shop_id AND status='waiting'   AND created_at::DATE=today),
      'total',    (SELECT COUNT(*) FROM tokens WHERE shop_id=p_shop_id AND created_at::DATE=today),
      'avg_wait', (
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/60))
        FROM tokens
        WHERE shop_id=p_shop_id AND status='completed'
          AND created_at::DATE=today AND completed_at IS NOT NULL
      )
    ),

    -- This week (7 days)
    'week', json_build_object(
      'served',  (SELECT COUNT(*) FROM tokens WHERE shop_id=p_shop_id AND status='completed' AND created_at::DATE >= week_ago),
      'total',   (SELECT COUNT(*) FROM tokens WHERE shop_id=p_shop_id AND created_at::DATE >= week_ago),
      'busiest_day', (
        SELECT TO_CHAR(created_at::DATE, 'Dy')
        FROM tokens
        WHERE shop_id=p_shop_id AND created_at::DATE >= week_ago
        GROUP BY created_at::DATE
        ORDER BY COUNT(*) DESC
        LIMIT 1
      )
    ),

    -- This month (30 days)
    'month', json_build_object(
      'served', (SELECT COUNT(*) FROM tokens WHERE shop_id=p_shop_id AND status='completed' AND created_at::DATE >= month_ago),
      'total',  (SELECT COUNT(*) FROM tokens WHERE shop_id=p_shop_id AND created_at::DATE >= month_ago)
    ),

    -- Peak hours (last 7 days, top 3 hours)
    'peak_hours', (
      SELECT json_agg(h ORDER BY cnt DESC)
      FROM (
        SELECT EXTRACT(HOUR FROM created_at)::INT AS hour, COUNT(*) AS cnt
        FROM tokens
        WHERE shop_id=p_shop_id AND created_at::DATE >= week_ago
        GROUP BY hour
        ORDER BY cnt DESC
        LIMIT 3
      ) h
    ),

    -- Daily breakdown last 7 days
    'daily', (
      SELECT json_agg(d ORDER BY d->>'date')
      FROM (
        SELECT json_build_object(
          'date',   TO_CHAR(created_at::DATE, 'YYYY-MM-DD'),
          'day',    TO_CHAR(created_at::DATE, 'Dy'),
          'total',  COUNT(*),
          'served', COUNT(*) FILTER (WHERE status='completed')
        ) AS d
        FROM tokens
        WHERE shop_id=p_shop_id AND created_at::DATE >= week_ago
        GROUP BY created_at::DATE
        ORDER BY created_at::DATE
      ) sub
    )

  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_shop_analytics(UUID) TO anon, authenticated;

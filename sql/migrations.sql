-- ============================================================
-- SAF QUEUE — Migrations (run after schema.sql)
-- ============================================================

-- 1. Add 'expired' and 'no_show' are already in schema.
--    Add called_at tracking if missing (safe to run):
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 2. Daily token reset function
--    Marks leftover 'waiting' tokens as 'expired'
--    Resets current_token counter on all shops
CREATE OR REPLACE FUNCTION reset_daily_tokens()
RETURNS void AS $$
BEGIN
  -- Expire all waiting tokens from previous day
  UPDATE tokens
  SET status = 'expired'
  WHERE status = 'waiting'
    AND created_at < CURRENT_DATE::TIMESTAMPTZ;

  -- Also complete any still-called tokens
  UPDATE tokens
  SET status = 'completed', completed_at = NOW()
  WHERE status = 'called'
    AND created_at < CURRENT_DATE::TIMESTAMPTZ;

  -- Reset token counter on all active shops
  UPDATE shops
  SET current_token = 0
  WHERE is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- 3. Get today's stats for a shop
CREATE OR REPLACE FUNCTION get_shop_stats(p_shop_id UUID)
RETURNS JSON AS $$
DECLARE
  today DATE := CURRENT_DATE;
  v_served    INT;
  v_no_show   INT;
  v_waiting   INT;
  v_total     INT;
BEGIN
  SELECT COUNT(*) INTO v_served   FROM tokens WHERE shop_id=p_shop_id AND status='completed' AND created_at::DATE=today;
  SELECT COUNT(*) INTO v_no_show  FROM tokens WHERE shop_id=p_shop_id AND status='no_show'   AND created_at::DATE=today;
  SELECT COUNT(*) INTO v_waiting  FROM tokens WHERE shop_id=p_shop_id AND status='waiting'   AND created_at::DATE=today;
  SELECT COUNT(*) INTO v_total    FROM tokens WHERE shop_id=p_shop_id AND created_at::DATE=today;

  RETURN json_build_object(
    'served',   v_served,
    'no_show',  v_no_show,
    'waiting',  v_waiting,
    'total',    v_total
  );
END;
$$ LANGUAGE plpgsql;

-- 4. Shop self-registrations table (Phase 3)
CREATE TABLE IF NOT EXISTS shop_registrations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  owner_phone  TEXT NOT NULL,
  category     TEXT,
  area         TEXT,
  pin          TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Business hours + location fields
-- ============================================================
ALTER TABLE shops ADD COLUMN IF NOT EXISTS opening_time  TEXT DEFAULT '09:00';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS closing_time  TEXT DEFAULT '21:00';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS description   TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS address       TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS latitude      NUMERIC(10,7);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS longitude     NUMERIC(10,7);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS avg_rating    NUMERIC(3,1) DEFAULT 5.0;

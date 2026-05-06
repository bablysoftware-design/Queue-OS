-- Run this in Supabase SQL Editor
-- Fixes login for existing shops

-- Ensure pin_hash column exists
ALTER TABLE shopkeepers ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- Ensure shop_registrations has required columns
ALTER TABLE shop_registrations ADD COLUMN IF NOT EXISTS token_mode  TEXT DEFAULT 'free';
ALTER TABLE shop_registrations ADD COLUMN IF NOT EXISTS token_price INT  DEFAULT 0;

-- For existing shops where pin was erased but pin_hash was never set,
-- this is a one-time fix: anyone with pin='' and no pin_hash needs a reset
-- (They'll need to re-register or admin resets their PIN)

SELECT
  s.name,
  s.owner_phone,
  k.pin,
  k.pin_hash,
  CASE
    WHEN k.pin_hash IS NOT NULL THEN 'hash ✅'
    WHEN k.pin != ''            THEN 'plain ✅'
    ELSE 'BROKEN ❌ — needs reset'
  END AS login_status
FROM shops s
JOIN shopkeepers k ON k.shop_id = s.id
ORDER BY s.name;

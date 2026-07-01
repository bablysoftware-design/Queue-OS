-- ============================================================
-- fix_expire_subscriptions.sql
-- SAFE TO RUN MULTIPLE TIMES (idempotent via CREATE OR REPLACE)
--
-- BUG FIXED: The original expire_subscriptions() function was
-- deactivating shops that had ANY expired subscription row,
-- including old ones from previous billing periods. This caused
-- shops with a valid current subscription to be deactivated
-- every time the cron ran, because their old expired rows
-- were still in the table.
--
-- Fix: only deactivate a shop when its MOST RECENT subscription
-- is expired — i.e. it has no active subscription AND its latest
-- row by created_at has status='expired'.
-- ============================================================

CREATE OR REPLACE FUNCTION expire_subscriptions()
RETURNS void AS $$
BEGIN
  -- Step 1: Mark subscriptions as expired where end_date has passed
  -- and they are still status='active'. This is safe and unchanged.
  UPDATE subscriptions
  SET    status = 'expired'
  WHERE  status = 'active'
    AND  end_date < CURRENT_DATE;

  -- Step 2: Deactivate shops whose CURRENT (most recent) subscription
  -- is expired. A shop that has old expired rows but a valid current
  -- active subscription must NOT be deactivated.
  --
  -- Logic: shop qualifies for deactivation only when:
  --   a) It has no active subscription row at all, AND
  --   b) Its most recent subscription row (by created_at) has
  --      status='expired' (not cancelled, not pending, just expired)
  UPDATE shops
  SET    is_active = FALSE
  WHERE  id IN (
    SELECT s.shop_id
    FROM   subscriptions s
    WHERE  s.status = 'expired'
      -- most recent row for this shop is the expired one
      AND  s.created_at = (
        SELECT MAX(s2.created_at)
        FROM   subscriptions s2
        WHERE  s2.shop_id = s.shop_id
      )
      -- double-check: no active subscription exists for this shop
      AND  NOT EXISTS (
        SELECT 1
        FROM   subscriptions s3
        WHERE  s3.shop_id = s.shop_id
          AND  s3.status  = 'active'
      )
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- subscriptions_unique_active.sql
-- Enforces: at most one status='active' row per shop_id.
-- SAFE TO RUN MULTIPLE TIMES (idempotent).
--
-- Step 1 resolves any pre-existing duplicates BEFORE the index
-- is created (CREATE UNIQUE INDEX fails outright if violations
-- already exist). Step 2 adds the partial unique index.
--
-- Step 1 uses the SAME tie-break rule as getActiveSubscription()
-- (newest created_at wins) — so this cleanup does not change
-- which subscription governs any shop. For any shop that
-- currently has multiple status='active' rows, only the row
-- getActiveSubscription() already returns is kept 'active';
-- the rest are marked 'cancelled'.
-- ============================================================

-- Step 1: Resolve any existing duplicate active rows per shop_id.
-- No-op if every shop already has 0 or 1 status='active' rows.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY shop_id
           ORDER BY created_at DESC
         ) AS rn
  FROM subscriptions
  WHERE status = 'active'
)
UPDATE subscriptions s
SET status = 'cancelled'
FROM ranked r
WHERE s.id = r.id
  AND r.rn > 1;

-- Step 2: Enforce the invariant going forward at the database level.
-- Any INSERT/UPDATE that would create a second status='active' row
-- for the same shop_id is rejected by Postgres (unique violation),
-- regardless of which code path (assignPlan, setCustomPlan,
-- reviewUpgradeRequest, or any future caller) attempts it.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_active_per_shop
  ON subscriptions (shop_id)
  WHERE status = 'active';

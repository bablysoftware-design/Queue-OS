-- ============================================================
-- payment_request_cancel.sql
-- Allows customers to cancel their own pending payment request.
-- SAFE TO RUN MULTIPLE TIMES (idempotent).
-- ============================================================

-- Drop the old constraint (named automatically by Postgres if not
-- explicitly named — find and drop by introspection-safe approach:
-- recreate the column's check via ALTER TABLE ... DROP CONSTRAINT
-- IF EXISTS using the default-generated name pattern, then re-add).

DO $$
BEGIN
  -- Find and drop the existing CHECK constraint on payment_requests.status
  EXECUTE (
    SELECT 'ALTER TABLE payment_requests DROP CONSTRAINT ' || conname
    FROM pg_constraint
    WHERE conrelid = 'payment_requests'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
    LIMIT 1
  );
EXCEPTION WHEN OTHERS THEN
  -- No matching constraint found — nothing to drop, continue
  NULL;
END $$;

-- Re-add with 'cancelled' included
ALTER TABLE payment_requests
  ADD CONSTRAINT payment_requests_status_check
  CHECK (status IN ('pending','approved','rejected','cancelled'));

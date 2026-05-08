-- ============================================================
-- Fix: Add UPDATE policy on shops table so the worker
-- (using anon/service key) can PATCH shop settings.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- Allow UPDATE on shops (worker uses service_role or anon key)
-- Since worker authenticates via JWT/apikey, we allow all updates
-- (the worker enforces shop ownership via session token itself)
DROP POLICY IF EXISTS "service_can_update_shops" ON shops;
CREATE POLICY "service_can_update_shops"
  ON shops FOR UPDATE
  USING (TRUE)
  WITH CHECK (TRUE);

-- Same for INSERT (needed for shop creation and registration approval)
DROP POLICY IF EXISTS "service_can_insert_shops" ON shops;
CREATE POLICY "service_can_insert_shops"
  ON shops FOR INSERT
  WITH CHECK (TRUE);

-- Confirm policies
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'shops'
ORDER BY cmd;

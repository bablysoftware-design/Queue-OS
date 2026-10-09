-- Queue OS / WaitMate — Phase 1 RPC execution hardening
-- SAFETY: This file is a reviewable draft. Do NOT run against production until
-- the post-deployment smoke-test checklist has been completed.
--
-- Why this exists:
-- The Worker uses the Supabase service-role key for database access. The live
-- database currently permits anon/authenticated to execute privileged
-- SECURITY DEFINER RPCs directly. These functions should be Worker-only.
--
-- This change intentionally does not alter tables, rows, function bodies,
-- queue ordering, token numbers, or existing clinic records.

BEGIN;

-- Functions that mutate operational data or expose shop-specific analytics.
REVOKE EXECUTE ON FUNCTION public.increment_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_token(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.reset_daily_tokens() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reset_daily_tokens() TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_sessions() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cleanup_sessions() TO service_role;

REVOKE EXECUTE ON FUNCTION public.expire_subscriptions() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.expire_subscriptions() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_shop_analytics(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_shop_analytics(uuid) TO service_role;

-- Additional RPCs used only by the Worker with its service-role key.
REVOKE EXECUTE ON FUNCTION public.count_customer_tokens_today(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.count_customer_tokens_today(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_shop_scan_counts(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_shop_scan_counts(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_shop_stats(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_shop_stats(uuid) TO service_role;

-- The Worker is the sole application data API in this repository. Current
-- PWA pages call the Worker and do not connect to Supabase directly. Remove
-- direct table/view/sequence privileges from public client roles while
-- preserving service_role privileges used by the Worker.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- Both live overloads are retained for compatibility. Public shop discovery
-- remains available through the existing Worker /public/shops route, which
-- calls the RPC using the service-role key.
REVOKE EXECUTE ON FUNCTION public.get_public_shops(text, text, integer, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_public_shops(text, text, integer, integer, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_public_shops(text, text, integer, integer, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_public_shops(text, text, integer, integer, text, text, text) TO service_role;

COMMIT;

-- Verification (run after applying, using an administrative SQL session):
-- Expected: anon_execute=false and authenticated_execute=false for every
-- listed worker-only RPC; service_role retains execute access. Direct table,
-- view, and sequence privileges for public client roles should also be false.
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'increment_token',
    'reset_daily_tokens',
    'cleanup_sessions',
    'expire_subscriptions',
    'get_shop_analytics',
    'count_customer_tokens_today',
    'get_shop_scan_counts',
    'get_shop_stats',
    'get_public_shops'
  )
ORDER BY p.proname, args;

-- ============================================================
-- PATCH 5 — Category canonicalization migration
-- 
-- INSTRUCTIONS:
--   1. Run this entire script in Supabase SQL Editor
--   2. Review the output of the final SELECT (cardinality report)
--   3. If correct → replace ROLLBACK with COMMIT and run again
--   4. If wrong   → just close — ROLLBACK already executed
--
-- This script is safe to run multiple times:
--   - The transaction is rolled back at the end until you commit
--   - Subsequent runs after COMMIT are idempotent (already canonical)
-- ============================================================

BEGIN;

-- ── Step 1: Show BEFORE state ─────────────────────────────────
-- Review this first to understand what will change
SELECT
  category                               AS original_value,
  COUNT(*)                               AS shop_count,
  STRING_AGG(name, ', ' ORDER BY name)   AS shop_names
FROM shops
GROUP BY category
ORDER BY shop_count DESC, category;

-- ── Step 2: Normalize to canonical values ─────────────────────

-- Exact canonical values: pass through unchanged
-- (barber, clinic, pharmacy, hospital, bank, govt, tailor, other)
-- These shops already have correct values and are untouched.

-- Barber variants → 'barber'
UPDATE shops
SET category = 'barber'
WHERE category IS NOT NULL
  AND LOWER(category) SIMILAR TO '%(barber|salon|hair|stylist|scissor|gents|hairdress)%'
  AND category NOT IN ('barber','clinic','pharmacy','hospital','bank','govt','tailor','other');

-- Clinic variants → 'clinic'
UPDATE shops
SET category = 'clinic'
WHERE category IS NOT NULL
  AND LOWER(category) SIMILAR TO '%(clinic|doctor|medical|physician|poly|specialist|dispensary)%'
  AND LOWER(category) NOT SIMILAR TO '%(hospital|pharma)%'
  AND category NOT IN ('barber','clinic','pharmacy','hospital','bank','govt','tailor','other');

-- Pharmacy variants → 'pharmacy'
UPDATE shops
SET category = 'pharmacy'
WHERE category IS NOT NULL
  AND LOWER(category) SIMILAR TO '%(pharma|chemist|medicine|drug)%'
  AND category NOT IN ('barber','clinic','pharmacy','hospital','bank','govt','tailor','other');

-- Hospital variants → 'hospital'
UPDATE shops
SET category = 'hospital'
WHERE category IS NOT NULL
  AND LOWER(category) SIMILAR TO '%(hospital)%'
  AND category NOT IN ('barber','clinic','pharmacy','hospital','bank','govt','tailor','other');

-- Bank/Finance variants → 'bank'
UPDATE shops
SET category = 'bank'
WHERE category IS NOT NULL
  AND LOWER(category) SIMILAR TO '%(bank|finance|microfinance|exchange)%'
  AND category NOT IN ('barber','clinic','pharmacy','hospital','bank','govt','tailor','other');

-- Govt variants → 'govt'
UPDATE shops
SET category = 'govt'
WHERE category IS NOT NULL
  AND LOWER(category) SIMILAR TO '%(govt|government|municipal|utility|passport|nadra)%'
  AND category NOT IN ('barber','clinic','pharmacy','hospital','bank','govt','tailor','other');

-- Tailor variants → 'tailor'
UPDATE shops
SET category = 'tailor'
WHERE category IS NOT NULL
  AND LOWER(category) SIMILAR TO '%(tailor|boutique|stitching|workshop|alteration)%'
  AND category NOT IN ('barber','clinic','pharmacy','hospital','bank','govt','tailor','other');

-- Everything else → 'other'
UPDATE shops
SET category = 'other'
WHERE category IS NOT NULL
  AND category NOT IN ('barber','clinic','pharmacy','hospital','bank','govt','tailor','other');

-- ── Step 3: Show AFTER state (cardinality report) ─────────────
SELECT
  category                             AS canonical_value,
  COUNT(*)                             AS shop_count,
  STRING_AGG(name, ', ' ORDER BY name) AS shop_names,
  CASE
    WHEN category IN ('barber','clinic','pharmacy','hospital','bank','govt','tailor','other')
    THEN '✅ canonical'
    ELSE '❌ NOT canonical — needs manual fix'
  END AS status
FROM shops
GROUP BY category
ORDER BY
  CASE category
    WHEN 'barber'   THEN 1
    WHEN 'clinic'   THEN 2
    WHEN 'pharmacy' THEN 3
    WHEN 'hospital' THEN 4
    WHEN 'bank'     THEN 5
    WHEN 'govt'     THEN 6
    WHEN 'tailor'   THEN 7
    WHEN 'other'    THEN 8
    ELSE 9
  END;

-- ── ROLLBACK until you review the output above ────────────────
-- When satisfied: replace ROLLBACK with COMMIT and run again.
ROLLBACK;

-- ============================================================
-- After COMMIT, also run this once to apply same normalization
-- to shop_registrations (historical registrations):
-- ============================================================
-- BEGIN;
-- UPDATE shop_registrations
-- SET category = CASE
--   WHEN LOWER(category) SIMILAR TO '%(barber|salon|hair|stylist|scissor|gents)%' THEN 'barber'
--   WHEN LOWER(category) SIMILAR TO '%(clinic|doctor|medical|physician|poly|specialist)%'
--        AND LOWER(category) NOT SIMILAR TO '%(hospital|pharma)%'                  THEN 'clinic'
--   WHEN LOWER(category) SIMILAR TO '%(pharma|chemist|medicine|drug)%'             THEN 'pharmacy'
--   WHEN LOWER(category) SIMILAR TO '%(hospital)%'                                 THEN 'hospital'
--   WHEN LOWER(category) SIMILAR TO '%(bank|finance|microfinance|exchange)%'       THEN 'bank'
--   WHEN LOWER(category) SIMILAR TO '%(govt|government|municipal|passport|nadra)%' THEN 'govt'
--   WHEN LOWER(category) SIMILAR TO '%(tailor|boutique|stitching|workshop)%'       THEN 'tailor'
--   ELSE 'other'
-- END
-- WHERE category NOT IN ('barber','clinic','pharmacy','hospital','bank','govt','tailor','other');
-- COMMIT;

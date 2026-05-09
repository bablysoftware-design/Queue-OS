-- ============================================================
-- Run ALL of these in Supabase SQL Editor in ONE execution.
-- This ensures customer_note and voice_note columns exist
-- and PostgREST schema cache is refreshed.
-- ============================================================

-- 1. Add customer_note column (safe, idempotent)
ALTER TABLE tokens
  ADD COLUMN IF NOT EXISTS customer_note TEXT;

-- 2. Add voice note columns (safe, idempotent)
ALTER TABLE tokens
  ADD COLUMN IF NOT EXISTS voice_note_url      TEXT,
  ADD COLUMN IF NOT EXISTS voice_note_duration INTEGER;

-- 3. Reload PostgREST schema cache so columns are visible immediately
NOTIFY pgrst, 'reload schema';

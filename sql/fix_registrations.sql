-- Fix missing columns in shop_registrations
ALTER TABLE shop_registrations
  ADD COLUMN IF NOT EXISTS token_price INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS country     TEXT,
  ADD COLUMN IF NOT EXISTS city        TEXT,
  ADD COLUMN IF NOT EXISTS token_mode  TEXT DEFAULT 'free';

-- Ensure shops table also has these safely
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS country     TEXT,
  ADD COLUMN IF NOT EXISTS city        TEXT,
  ADD COLUMN IF NOT EXISTS status      TEXT DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS token_price INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS token_mode  TEXT NOT NULL DEFAULT 'free';

-- Set all existing shops to approved
UPDATE shops SET status = 'approved' WHERE status IS NULL OR status = '';

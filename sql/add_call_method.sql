-- Safe additive migration: add call_method column to tokens
-- Distinguishes normal queue calls from manual/emergency calls
ALTER TABLE tokens
  ADD COLUMN IF NOT EXISTS call_method TEXT DEFAULT NULL;

-- call_method values:
--   NULL     = normal queue advance (existing behavior, unchanged)
--   'manual' = manual Call Now by shopkeeper
-- Future:   'counter_1', 'counter_2' etc for multi-counter support

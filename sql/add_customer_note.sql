-- Safe: adds nullable column, no existing rows affected, no constraints broken
ALTER TABLE tokens
  ADD COLUMN IF NOT EXISTS customer_note TEXT;

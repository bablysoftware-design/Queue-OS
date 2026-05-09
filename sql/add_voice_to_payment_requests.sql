-- Add voice/note fields to payment_requests so they survive until approval
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS customer_note      TEXT,
  ADD COLUMN IF NOT EXISTS voice_note_path    TEXT,
  ADD COLUMN IF NOT EXISTS voice_note_duration INTEGER;

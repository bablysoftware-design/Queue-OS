-- Ensure token_id column exists in payment_requests
ALTER TABLE payment_requests 
  ADD COLUMN IF NOT EXISTS token_id UUID REFERENCES tokens(id) ON DELETE SET NULL;

-- Ensure reviewed_at column exists
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

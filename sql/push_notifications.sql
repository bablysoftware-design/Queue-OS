-- ============================================================
-- Push notification subscriptions
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id     UUID NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  shop_id      UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(token_id)
);

CREATE INDEX IF NOT EXISTS idx_push_token_id ON push_subscriptions(token_id);
CREATE INDEX IF NOT EXISTS idx_push_shop_id  ON push_subscriptions(shop_id);

-- Grace period tracking on tokens
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS grace_started_at TIMESTAMPTZ;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS notified_position INT DEFAULT 0;
-- 0=none sent, 1=position-3 sent, 2=position-1 sent, 3=called sent

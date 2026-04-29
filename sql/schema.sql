-- ============================================================
-- SAF QUEUE — Supabase SQL Schema
-- Multi-tenant SaaS | Monetization-Ready | Scalable
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PLANS — Source of truth for pricing tiers
-- ============================================================
CREATE TABLE plans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL UNIQUE,         -- 'free', 'basic', 'pro'
  price           NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_days   INT NOT NULL DEFAULT 30,
  max_tokens_per_day INT NOT NULL DEFAULT 50,
  max_queue_size  INT NOT NULL DEFAULT 20,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default plans
INSERT INTO plans (name, price, duration_days, max_tokens_per_day, max_queue_size) VALUES
  ('free',  0,     30,  50,  20),
  ('basic', 999,   30,  200, 100),
  ('pro',   2499,  30,  999, 500);

-- ============================================================
-- SHOPS — One per business owner
-- ============================================================
CREATE TABLE shops (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  TEXT NOT NULL,
  category              TEXT,                           -- 'barber', 'clinic', 'govt', etc.
  area                  TEXT,
  owner_phone           TEXT NOT NULL UNIQUE,           -- WhatsApp number (with country code)
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  is_open               BOOLEAN NOT NULL DEFAULT FALSE,
  current_token         INT NOT NULL DEFAULT 0,
  avg_service_time_mins INT NOT NULL DEFAULT 10,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shops_owner_phone ON shops(owner_phone);
CREATE INDEX idx_shops_is_active   ON shops(is_active);

-- ============================================================
-- SHOPKEEPERS — PIN-based auth (per shop)
-- ============================================================
CREATE TABLE shopkeepers (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id    UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  pin        TEXT NOT NULL,                             -- 4-digit PIN (store as plain text or hashed)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shopkeepers_shop_id ON shopkeepers(shop_id);

-- ============================================================
-- SUBSCRIPTIONS — One active subscription per shop
-- ============================================================
CREATE TABLE subscriptions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id             UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  plan_name           TEXT NOT NULL DEFAULT 'free',
  status              TEXT NOT NULL DEFAULT 'active',   -- 'active', 'expired', 'cancelled'
  start_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date            DATE NOT NULL,
  max_tokens_per_day  INT NOT NULL,
  max_queue_size      INT NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_sub_plan FOREIGN KEY (plan_name) REFERENCES plans(name)
);

CREATE INDEX idx_subscriptions_shop_id ON subscriptions(shop_id);
CREATE INDEX idx_subscriptions_status  ON subscriptions(status);

-- ============================================================
-- TOKENS — Queue entries per shop
-- ============================================================
CREATE TABLE tokens (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id        UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  token_number   INT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'waiting',       -- 'waiting','called','completed','no_show'
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  called_at      TIMESTAMPTZ,
  CONSTRAINT unique_token_per_shop UNIQUE (shop_id, token_number)
);

CREATE INDEX idx_tokens_shop_id ON tokens(shop_id);
CREATE INDEX idx_tokens_status  ON tokens(status);
CREATE INDEX idx_tokens_created ON tokens(created_at);

-- ============================================================
-- HELPER FUNCTION: Auto-provision free trial on new shop
-- ============================================================
CREATE OR REPLACE FUNCTION provision_free_trial()
RETURNS TRIGGER AS $$
DECLARE
  v_plan plans%ROWTYPE;
BEGIN
  SELECT * INTO v_plan FROM plans WHERE name = 'free';

  INSERT INTO subscriptions (
    shop_id,
    plan_name,
    status,
    start_date,
    end_date,
    max_tokens_per_day,
    max_queue_size
  ) VALUES (
    NEW.id,
    'free',
    'active',
    CURRENT_DATE,
    CURRENT_DATE + v_plan.duration_days,
    v_plan.max_tokens_per_day,
    v_plan.max_queue_size
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: auto-provision free trial when a shop is created
CREATE TRIGGER trg_provision_free_trial
  AFTER INSERT ON shops
  FOR EACH ROW EXECUTE FUNCTION provision_free_trial();

-- ============================================================
-- HELPER FUNCTION: Expire subscriptions past end_date
-- Called by a Supabase cron job (pg_cron) or Cloudflare scheduled worker
-- ============================================================
CREATE OR REPLACE FUNCTION expire_subscriptions()
RETURNS void AS $$
BEGIN
  -- Mark subscriptions as expired
  UPDATE subscriptions
  SET status = 'expired'
  WHERE status = 'active'
    AND end_date < CURRENT_DATE;

  -- Deactivate shops whose subscription expired
  UPDATE shops
  SET is_active = FALSE
  WHERE id IN (
    SELECT shop_id FROM subscriptions
    WHERE status = 'expired'
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VIEW: Active queue per shop (easy query for dashboard)
-- ============================================================
CREATE VIEW v_active_queue AS
SELECT
  t.id,
  t.shop_id,
  t.customer_phone,
  t.token_number,
  t.status,
  t.created_at,
  s.name AS shop_name,
  s.current_token,
  s.avg_service_time_mins
FROM tokens t
JOIN shops s ON s.id = t.shop_id
WHERE t.status = 'waiting'
ORDER BY t.token_number ASC;

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — Enable per-shop data isolation
-- ============================================================
ALTER TABLE shops         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens        ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopkeepers   ENABLE ROW LEVEL SECURITY;

-- NOTE: For Cloudflare Workers using service_role key, RLS is bypassed.
-- RLS policies below are for future direct client access (optional).

-- ============================================================
-- END OF SCHEMA
-- ============================================================

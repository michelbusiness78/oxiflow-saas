-- ─── 010 : Tables Stripe (customers + subscriptions) ────────────────────────
--
-- À exécuter dans le SQL Editor du Dashboard Supabase.
-- Le client admin (service_role) bypass RLS — les policies sont là pour
-- sécuriser les accès directs via anon key.

-- ─── stripe_customers ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stripe_customers (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer_id  TEXT        NOT NULL UNIQUE,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS stripe_customers_tenant_idx
  ON stripe_customers(tenant_id);

ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON stripe_customers
  FOR ALL USING (
    tenant_id = current_setting('app.tenant_id', true)::uuid
  );

-- ─── subscriptions ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id               UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_subscription_id  TEXT        NOT NULL UNIQUE,
  plan                    TEXT        NOT NULL
    CHECK (plan IN ('solo', 'team', 'pro')),
  status                  TEXT        NOT NULL
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled')),
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at               TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_tenant_idx
  ON subscriptions(tenant_id);

CREATE INDEX IF NOT EXISTS subscriptions_stripe_id_idx
  ON subscriptions(stripe_subscription_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON subscriptions
  FOR ALL USING (
    tenant_id = current_setting('app.tenant_id', true)::uuid
  );

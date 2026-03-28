-- =============================================================================
-- OxiFlow — 007 : Paramètres société + statut utilisateurs
-- =============================================================================

-- ── tenants : colonnes manquantes ─────────────────────────────────────────────

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS cp                   TEXT,
  ADD COLUMN IF NOT EXISTS ville                TEXT,
  ADD COLUMN IF NOT EXISTS iban                 TEXT,
  ADD COLUMN IF NOT EXISTS bic                  TEXT,
  ADD COLUMN IF NOT EXISTS conditions_paiement  TEXT NOT NULL DEFAULT 'Paiement à 30 jours',
  ADD COLUMN IF NOT EXISTS mentions_legales     TEXT,
  ADD COLUMN IF NOT EXISTS plan                 TEXT NOT NULL DEFAULT 'trial'
    CHECK (plan IN ('trial', 'solo', 'team', 'pro')),
  ADD COLUMN IF NOT EXISTS plan_debut           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS plan_fin             TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days');

-- ── users : statut actif/inactif ──────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive'));

-- ── RLS tenants ───────────────────────────────────────────────────────────────

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Les membres d'un tenant peuvent lire leur tenant
CREATE POLICY "tenant_select" ON tenants FOR SELECT
  USING (id = auth_tenant_id());

-- Seul le dirigeant peut modifier (contrôlé aussi côté applicatif)
CREATE POLICY "tenant_update" ON tenants FOR UPDATE
  USING (id = auth_tenant_id());

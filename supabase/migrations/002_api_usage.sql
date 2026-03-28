-- =============================================================================
-- OxiFlow — Migration 002
-- Table api_usage : logs d'utilisation de l'agent Claude
-- =============================================================================

CREATE TABLE api_usage (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID          NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  tokens_in   INTEGER       NOT NULL DEFAULT 0 CHECK (tokens_in  >= 0),
  tokens_out  INTEGER       NOT NULL DEFAULT 0 CHECK (tokens_out >= 0),
  model       TEXT          NOT NULL DEFAULT 'claude-sonnet-4-6',
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Pas de updated_at : table append-only, on ne modifie jamais un log

-- ── Index ─────────────────────────────────────────────────────────────────────
-- Requête KPI : total tokens par tenant sur une période
CREATE INDEX idx_api_usage_tenant_date   ON api_usage(tenant_id, created_at DESC);
-- Requête par user (audit / debug)
CREATE INDEX idx_api_usage_user_date     ON api_usage(user_id, created_at DESC);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Lecture : chaque tenant voit uniquement son usage
CREATE POLICY "tenant_isolation" ON api_usage
  USING (tenant_id = auth_tenant_id());

-- Insertion : autorisée uniquement côté serveur (service_role bypass RLS)
-- Les clients ne peuvent pas insérer directement.
CREATE POLICY "no_client_insert" ON api_usage
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (FALSE);

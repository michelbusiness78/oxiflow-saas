-- =============================================================================
-- Migration 009 — Catalogue produits / services
-- =============================================================================

CREATE TABLE IF NOT EXISTS catalogue (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ref         TEXT,
  designation TEXT        NOT NULL,
  description TEXT,
  type        TEXT        NOT NULL DEFAULT 'materiel'
                CHECK (type IN ('materiel','service','main_oeuvre','fourniture')),
  prix_achat  NUMERIC(10,2) DEFAULT 0,
  prix_vente  NUMERIC(10,2) DEFAULT 0,
  tva         NUMERIC(4,1)  DEFAULT 20,
  unite       TEXT          DEFAULT 'u'
                CHECK (unite IN ('u','h','j','ml','m2','kg','forfait')),
  actif       BOOLEAN     DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalogue_tenant_idx ON catalogue(tenant_id);

ALTER TABLE catalogue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON catalogue
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

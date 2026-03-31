-- =============================================================================
-- OxiFlow — Migration 013 : Système de devis (quotes)
-- Table parallèle à devis (ancien système conservé pour FactureList)
-- Lignes stockées en JSONB pour cohérence avec le reste
-- =============================================================================

CREATE TABLE IF NOT EXISTS quotes (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id    UUID          REFERENCES clients(id) ON DELETE SET NULL,
  number       TEXT          NOT NULL,
  objet        TEXT,
  date         DATE          NOT NULL DEFAULT CURRENT_DATE,
  validity     DATE,
  statut       TEXT          NOT NULL DEFAULT 'brouillon'
                             CHECK (statut IN ('brouillon', 'envoye', 'accepte', 'refuse')),
  lignes       JSONB         NOT NULL DEFAULT '[]',
  notes        TEXT,
  conditions   TEXT,
  montant_ht   NUMERIC(12,2) NOT NULL DEFAULT 0,
  tva_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  montant_ttc  NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

SELECT create_updated_at_trigger('quotes');

CREATE UNIQUE INDEX IF NOT EXISTS uq_quotes_tenant_number ON quotes(tenant_id, number);
CREATE INDEX IF NOT EXISTS idx_quotes_tenant        ON quotes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_statut ON quotes(tenant_id, statut);
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_client ON quotes(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_date   ON quotes(tenant_id, date DESC);

-- RLS
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY quotes_tenant_isolation ON quotes
  USING (tenant_id = auth_tenant_id());

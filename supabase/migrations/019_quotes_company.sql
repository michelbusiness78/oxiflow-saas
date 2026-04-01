-- ─── R9 Fix: company_id sur les devis ────────────────────────────────────────
-- Lie chaque devis à une société (companies) plutôt qu'au tenant générique.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_company ON quotes(company_id);

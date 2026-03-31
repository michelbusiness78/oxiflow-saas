-- ─── R11 : Module Factures ────────────────────────────────────────────────────
-- Tables invoices + invoice_lines pour le cycle devis → facture

-- ─── invoices ─────────────────────────────────────────────────────────────────

CREATE TABLE invoices (
  id             UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      UUID          NOT NULL REFERENCES tenants(id),
  number         VARCHAR(30)   NOT NULL,
  type           VARCHAR(20)   DEFAULT 'facture',   -- facture | avoir
  quote_id       UUID          REFERENCES quotes(id),
  quote_number   VARCHAR(30),
  client_id      UUID          NOT NULL REFERENCES clients(id),
  company_id     UUID,
  date_facture   DATE          DEFAULT CURRENT_DATE,
  date_echeance  DATE,
  status         VARCHAR(20)   DEFAULT 'brouillon', -- brouillon | emise | payee | en_retard
  conditions     TEXT,
  notes          TEXT,
  total_ht       NUMERIC(12,2) DEFAULT 0,
  total_tva      NUMERIC(12,2) DEFAULT 0,
  total_ttc      NUMERIC(12,2) DEFAULT 0,
  created_at     TIMESTAMPTZ   DEFAULT now(),
  updated_at     TIMESTAMPTZ   DEFAULT now()
);

-- ─── invoice_lines ────────────────────────────────────────────────────────────

CREATE TABLE invoice_lines (
  id               UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id       UUID          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  sort_order       INTEGER       DEFAULT 0,
  reference        VARCHAR(50),
  type             VARCHAR(20)   DEFAULT 'materiel',
  designation      TEXT          NOT NULL,
  quantity         NUMERIC(10,2) DEFAULT 1,
  unit_price       NUMERIC(10,2) DEFAULT 0,
  discount_percent NUMERIC(5,2)  DEFAULT 0,
  vat_rate         NUMERIC(4,1)  DEFAULT 20.0,
  created_at       TIMESTAMPTZ   DEFAULT now()
);

-- ─── Index ────────────────────────────────────────────────────────────────────

CREATE INDEX idx_invoices_tenant       ON invoices(tenant_id, status);
CREATE INDEX idx_invoices_quote        ON invoices(quote_id);
CREATE INDEX idx_invoice_lines_invoice ON invoice_lines(invoice_id, sort_order);

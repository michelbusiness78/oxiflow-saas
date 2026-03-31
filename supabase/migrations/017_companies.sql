-- ─── R8 : Module Paramètres multi-sociétés ──────────────────────────────────

-- ─── companies ───────────────────────────────────────────────────────────────

CREATE TABLE companies (
  id                          UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                   UUID          NOT NULL REFERENCES tenants(id),
  name                        VARCHAR(100)  NOT NULL,
  siret                       VARCHAR(14),
  tva_number                  VARCHAR(20),
  address                     TEXT,
  postal_code                 VARCHAR(10),
  city                        VARCHAR(100),
  phone                       VARCHAR(20),
  email                       VARCHAR(100),
  website                     VARCHAR(200),
  iban                        VARCHAR(34),
  bic                         VARCHAR(11),
  logo_url                    TEXT,
  color                       VARCHAR(7)    DEFAULT '#2563eb',
  mention_tva                 TEXT          DEFAULT 'TVA sur encaissements',
  conditions_paiement_defaut  TEXT          DEFAULT '30 jours fin de mois',
  pied_facture                TEXT,
  active                      BOOLEAN       DEFAULT true,
  created_at                  TIMESTAMPTZ   DEFAULT now(),
  updated_at                  TIMESTAMPTZ   DEFAULT now()
);

-- ─── company_objectives ──────────────────────────────────────────────────────

CREATE TABLE company_objectives (
  id             UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id     UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tenant_id      UUID          NOT NULL,
  year           INTEGER       DEFAULT EXTRACT(YEAR FROM now()),
  monthly_target NUMERIC(12,2) DEFAULT 0,
  annual_target  NUMERIC(12,2) DEFAULT 0,
  created_at     TIMESTAMPTZ   DEFAULT now(),
  UNIQUE(company_id, year)
);

-- ─── Index ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_companies_tenant  ON companies(tenant_id, active);
CREATE INDEX idx_company_obj       ON company_objectives(company_id, year);

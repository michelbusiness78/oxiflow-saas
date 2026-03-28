-- ─────────────────────────────────────────────────────────────────────────────
-- 005 — Module RH : Congés, Notes de frais, Soldes
-- ─────────────────────────────────────────────────────────────────────────────
-- PRÉREQUIS : créer le bucket Storage "rh" (public) dans le Dashboard Supabase.

-- ── Types ─────────────────────────────────────────────────────────────────────

CREATE TYPE conge_type    AS ENUM ('cp', 'rtt', 'maladie', 'sans_solde');
CREATE TYPE conge_statut  AS ENUM ('en_attente', 'valide', 'refuse');
CREATE TYPE frais_cat     AS ENUM ('transport', 'repas', 'hebergement', 'fournitures', 'autre');
CREATE TYPE frais_statut  AS ENUM ('soumise', 'validee', 'remboursee', 'rejetee');

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE conges (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID          NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  type        conge_type    NOT NULL,
  date_debut  DATE          NOT NULL,
  date_fin    DATE          NOT NULL,
  nb_jours    SMALLINT      NOT NULL CHECK (nb_jours > 0),
  commentaire TEXT,
  statut      conge_statut  NOT NULL DEFAULT 'en_attente',
  valide_par  UUID          REFERENCES users(id),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
SELECT create_updated_at_trigger('conges');

CREATE TABLE notes_frais (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id          UUID          NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  date             DATE          NOT NULL,
  montant          NUMERIC(10,2) NOT NULL CHECK (montant > 0),
  categorie        frais_cat     NOT NULL,
  description      TEXT,
  justificatif_url TEXT,
  statut           frais_statut  NOT NULL DEFAULT 'soumise',
  valide_par       UUID          REFERENCES users(id),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);
SELECT create_updated_at_trigger('notes_frais');

CREATE TABLE soldes_conges (
  id        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id   UUID          NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  type      TEXT          NOT NULL CHECK (type IN ('cp', 'rtt')),
  solde     NUMERIC(5,2)  NOT NULL DEFAULT 0,
  UNIQUE (user_id, type)
);

CREATE TABLE mouvements_soldes (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    UUID          NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  type       TEXT          NOT NULL CHECK (type IN ('cp', 'rtt')),
  delta      NUMERIC(5,2)  NOT NULL,
  motif      TEXT          NOT NULL,
  conge_id   UUID          REFERENCES conges(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_conges_tenant      ON conges(tenant_id);
CREATE INDEX idx_conges_user        ON conges(tenant_id, user_id);
CREATE INDEX idx_conges_statut      ON conges(tenant_id, statut);
CREATE INDEX idx_conges_dates       ON conges(tenant_id, date_debut, date_fin);

CREATE INDEX idx_notes_frais_tenant ON notes_frais(tenant_id);
CREATE INDEX idx_notes_frais_user   ON notes_frais(tenant_id, user_id);
CREATE INDEX idx_notes_frais_statut ON notes_frais(tenant_id, statut);

CREATE INDEX idx_soldes_user        ON soldes_conges(user_id, type);

CREATE INDEX idx_mouv_user          ON mouvements_soldes(tenant_id, user_id);
CREATE INDEX idx_mouv_date          ON mouvements_soldes(tenant_id, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE conges            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes_frais       ENABLE ROW LEVEL SECURITY;
ALTER TABLE soldes_conges     ENABLE ROW LEVEL SECURITY;
ALTER TABLE mouvements_soldes ENABLE ROW LEVEL SECURITY;

-- conges
CREATE POLICY "tenant_isolation" ON conges
  USING (tenant_id = auth_tenant_id());
CREATE POLICY "tenant_insert"    ON conges FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "tenant_update"    ON conges FOR UPDATE
  USING (tenant_id = auth_tenant_id());
CREATE POLICY "tenant_delete"    ON conges FOR DELETE
  USING (tenant_id = auth_tenant_id());

-- notes_frais
CREATE POLICY "tenant_isolation" ON notes_frais
  USING (tenant_id = auth_tenant_id());
CREATE POLICY "tenant_insert"    ON notes_frais FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "tenant_update"    ON notes_frais FOR UPDATE
  USING (tenant_id = auth_tenant_id());
CREATE POLICY "tenant_delete"    ON notes_frais FOR DELETE
  USING (tenant_id = auth_tenant_id());

-- soldes_conges
CREATE POLICY "tenant_isolation" ON soldes_conges
  USING (tenant_id = auth_tenant_id());
CREATE POLICY "tenant_insert"    ON soldes_conges FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "tenant_update"    ON soldes_conges FOR UPDATE
  USING (tenant_id = auth_tenant_id());

-- mouvements_soldes
CREATE POLICY "tenant_isolation" ON mouvements_soldes
  USING (tenant_id = auth_tenant_id());
CREATE POLICY "tenant_insert"    ON mouvements_soldes FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());

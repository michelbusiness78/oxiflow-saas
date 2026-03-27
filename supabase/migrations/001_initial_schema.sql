-- =============================================================================
-- OxiFlow — Migration initiale
-- 001_initial_schema.sql
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- recherche textuelle

-- =============================================================================
-- HELPER : updated_at automatique
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Macro pour créer le trigger updated_at (appelée après chaque CREATE TABLE)
CREATE OR REPLACE FUNCTION create_updated_at_trigger(tbl TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE format(
    'CREATE TRIGGER trg_%I_updated_at
     BEFORE UPDATE ON %I
     FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
    tbl, tbl
  );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 1. TENANTS
-- =============================================================================
CREATE TABLE tenants (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT        NOT NULL,
  siret        VARCHAR(14),
  tva_intra    VARCHAR(20),
  address      TEXT,
  phone        VARCHAR(20),
  email        TEXT,
  logo_url     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_updated_at_trigger('tenants');

-- =============================================================================
-- 2. USERS
-- =============================================================================
CREATE TYPE user_role AS ENUM (
  'dirigeant',
  'commercial',
  'technicien',
  'chef_projet',
  'rh'
);

CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email        TEXT        NOT NULL UNIQUE,
  name         TEXT        NOT NULL,
  role         user_role   NOT NULL DEFAULT 'commercial',
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_updated_at_trigger('users');

CREATE INDEX idx_users_tenant      ON users(tenant_id);
CREATE INDEX idx_users_tenant_role ON users(tenant_id, role);

-- =============================================================================
-- 3. CLIENTS
-- =============================================================================
CREATE TABLE clients (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom          TEXT        NOT NULL,
  contact      TEXT,
  email        TEXT,
  tel          VARCHAR(20),
  adresse      TEXT,
  cp           VARCHAR(10),
  ville        TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_updated_at_trigger('clients');

CREATE INDEX idx_clients_tenant      ON clients(tenant_id);
CREATE INDEX idx_clients_tenant_nom  ON clients(tenant_id, nom);
-- Recherche full-text sur nom et ville
CREATE INDEX idx_clients_nom_trgm    ON clients USING GIN (nom gin_trgm_ops);

-- =============================================================================
-- 4. DEVIS
-- =============================================================================
CREATE TYPE devis_statut AS ENUM (
  'brouillon',
  'envoye',
  'accepte',
  'refuse'
);

CREATE TABLE devis (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id     UUID          NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  commercial_id UUID          REFERENCES users(id) ON DELETE SET NULL,
  num           TEXT          NOT NULL,
  date          DATE          NOT NULL DEFAULT CURRENT_DATE,
  validite      DATE,
  statut        devis_statut  NOT NULL DEFAULT 'brouillon',
  lignes        JSONB         NOT NULL DEFAULT '[]',
  montant_ht    NUMERIC(12,2) NOT NULL DEFAULT 0,
  tva           NUMERIC(12,2) NOT NULL DEFAULT 0,
  montant_ttc   NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

SELECT create_updated_at_trigger('devis');

CREATE INDEX idx_devis_tenant         ON devis(tenant_id);
CREATE INDEX idx_devis_tenant_statut  ON devis(tenant_id, statut);
CREATE INDEX idx_devis_tenant_client  ON devis(tenant_id, client_id);
CREATE INDEX idx_devis_tenant_date    ON devis(tenant_id, date DESC);

-- =============================================================================
-- 5. FACTURES
-- =============================================================================
CREATE TYPE facture_statut AS ENUM (
  'brouillon',
  'envoyee',
  'payee',
  'partielle',
  'impayee'
);

CREATE TABLE factures (
  id           UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID           NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id    UUID           NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  devis_id     UUID           REFERENCES devis(id) ON DELETE SET NULL,
  num          TEXT           NOT NULL,
  date         DATE           NOT NULL DEFAULT CURRENT_DATE,
  echeance     DATE,
  statut       facture_statut NOT NULL DEFAULT 'brouillon',
  lignes       JSONB          NOT NULL DEFAULT '[]',
  montant_ht   NUMERIC(12,2)  NOT NULL DEFAULT 0,
  montant_ttc  NUMERIC(12,2)  NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

SELECT create_updated_at_trigger('factures');

CREATE INDEX idx_factures_tenant        ON factures(tenant_id);
CREATE INDEX idx_factures_tenant_statut ON factures(tenant_id, statut);
CREATE INDEX idx_factures_tenant_client ON factures(tenant_id, client_id);
CREATE INDEX idx_factures_tenant_date   ON factures(tenant_id, date DESC);
CREATE INDEX idx_factures_echeance      ON factures(tenant_id, echeance) WHERE statut IN ('envoyee','partielle','impayee');

-- =============================================================================
-- 6. PROJETS
-- =============================================================================
CREATE TABLE projets (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id        UUID        NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  devis_id         UUID        REFERENCES devis(id) ON DELETE SET NULL,
  chef_projet_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
  nom              TEXT        NOT NULL,
  statut           TEXT        NOT NULL DEFAULT 'en_attente',
  date_debut       DATE,
  date_fin_prevue  DATE,
  pct_avancement   SMALLINT    NOT NULL DEFAULT 0 CHECK (pct_avancement BETWEEN 0 AND 100),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_updated_at_trigger('projets');

CREATE INDEX idx_projets_tenant        ON projets(tenant_id);
CREATE INDEX idx_projets_tenant_statut ON projets(tenant_id, statut);
CREATE INDEX idx_projets_tenant_client ON projets(tenant_id, client_id);
CREATE INDEX idx_projets_chef          ON projets(tenant_id, chef_projet_id);

-- =============================================================================
-- 7. DOSSIERS
-- =============================================================================
CREATE TABLE dossiers (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id    UUID        NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  projet_id    UUID        REFERENCES projets(id) ON DELETE SET NULL,
  type_projet  TEXT,
  statut       TEXT        NOT NULL DEFAULT 'ouvert',
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_updated_at_trigger('dossiers');

CREATE INDEX idx_dossiers_tenant        ON dossiers(tenant_id);
CREATE INDEX idx_dossiers_tenant_client ON dossiers(tenant_id, client_id);
CREATE INDEX idx_dossiers_tenant_statut ON dossiers(tenant_id, statut);

-- =============================================================================
-- 8. CONTRATS
-- =============================================================================
CREATE TYPE contrat_type AS ENUM (
  'maintenance',
  'support',
  'location'
);

CREATE TABLE contrats (
  id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id        UUID         NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  dossier_id       UUID         REFERENCES dossiers(id) ON DELETE SET NULL,
  type             contrat_type NOT NULL,
  date_debut       DATE         NOT NULL,
  date_fin         DATE,
  montant_mensuel  NUMERIC(10,2),
  actif            BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

SELECT create_updated_at_trigger('contrats');

CREATE INDEX idx_contrats_tenant        ON contrats(tenant_id);
CREATE INDEX idx_contrats_tenant_client ON contrats(tenant_id, client_id);
CREATE INDEX idx_contrats_tenant_actif  ON contrats(tenant_id, actif);
CREATE INDEX idx_contrats_date_fin      ON contrats(tenant_id, date_fin) WHERE actif = TRUE;

-- =============================================================================
-- 9. INTERVENTIONS
-- =============================================================================
CREATE TYPE intervention_type AS ENUM (
  'installation',
  'maintenance',
  'sav',
  'depannage'
);

CREATE TYPE intervention_statut AS ENUM (
  'planifiee',
  'en_cours',
  'terminee',
  'annulee'
);

CREATE TABLE interventions (
  id             UUID                 PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID                 NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id      UUID                 NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  projet_id      UUID                 REFERENCES projets(id) ON DELETE SET NULL,
  technicien_id  UUID                 REFERENCES users(id) ON DELETE SET NULL,
  date           TIMESTAMPTZ          NOT NULL,
  type           intervention_type    NOT NULL,
  statut         intervention_statut  NOT NULL DEFAULT 'planifiee',
  duree_minutes  INTEGER,
  notes          TEXT,
  photos         JSONB                NOT NULL DEFAULT '[]',
  created_at     TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

SELECT create_updated_at_trigger('interventions');

CREATE INDEX idx_interventions_tenant          ON interventions(tenant_id);
CREATE INDEX idx_interventions_tenant_statut   ON interventions(tenant_id, statut);
CREATE INDEX idx_interventions_tenant_client   ON interventions(tenant_id, client_id);
CREATE INDEX idx_interventions_tenant_techni   ON interventions(tenant_id, technicien_id);
CREATE INDEX idx_interventions_date            ON interventions(tenant_id, date DESC);

-- =============================================================================
-- 10. SAV TICKETS
-- =============================================================================
CREATE TYPE sav_statut AS ENUM (
  'ouvert',
  'en_cours',
  'resolu',
  'cloture'
);

CREATE TYPE sav_priorite AS ENUM (
  'faible',
  'normale',
  'haute',
  'urgente'
);

CREATE TABLE sav_tickets (
  id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id        UUID         NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  contrat_id       UUID         REFERENCES contrats(id) ON DELETE SET NULL,
  intervention_id  UUID         REFERENCES interventions(id) ON DELETE SET NULL,
  priorite         sav_priorite NOT NULL DEFAULT 'normale',
  statut           sav_statut   NOT NULL DEFAULT 'ouvert',
  description      TEXT         NOT NULL,
  date_ouverture   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  date_resolution  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

SELECT create_updated_at_trigger('sav_tickets');

CREATE INDEX idx_sav_tenant          ON sav_tickets(tenant_id);
CREATE INDEX idx_sav_tenant_statut   ON sav_tickets(tenant_id, statut);
CREATE INDEX idx_sav_tenant_client   ON sav_tickets(tenant_id, client_id);
CREATE INDEX idx_sav_tenant_priorite ON sav_tickets(tenant_id, priorite) WHERE statut IN ('ouvert','en_cours');

-- =============================================================================
-- 11. TACHES
-- =============================================================================
CREATE TYPE tache_etat AS ENUM (
  'a_faire',
  'en_cours',
  'en_review',
  'terminee'
);

CREATE TYPE tache_priorite AS ENUM (
  'faible',
  'normale',
  'haute',
  'urgente'
);

CREATE TABLE taches (
  id              UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID           NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  projet_id       UUID           REFERENCES projets(id) ON DELETE CASCADE,
  assigne_a       UUID           REFERENCES users(id) ON DELETE SET NULL,
  titre           TEXT           NOT NULL,
  priorite        tache_priorite NOT NULL DEFAULT 'normale',
  etat            tache_etat     NOT NULL DEFAULT 'a_faire',
  date_echeance   DATE,
  pct_avancement  SMALLINT       NOT NULL DEFAULT 0 CHECK (pct_avancement BETWEEN 0 AND 100),
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

SELECT create_updated_at_trigger('taches');

CREATE INDEX idx_taches_tenant        ON taches(tenant_id);
CREATE INDEX idx_taches_tenant_projet ON taches(tenant_id, projet_id);
CREATE INDEX idx_taches_tenant_user   ON taches(tenant_id, assigne_a);
CREATE INDEX idx_taches_tenant_etat   ON taches(tenant_id, etat);
CREATE INDEX idx_taches_echeance      ON taches(tenant_id, date_echeance) WHERE etat != 'terminee';

-- =============================================================================
-- 12. CONGES
-- =============================================================================
CREATE TYPE conge_statut AS ENUM (
  'en_attente',
  'approuve',
  'refuse',
  'annule'
);

CREATE TYPE conge_type AS ENUM (
  'cp',
  'rtt',
  'maladie',
  'sans_solde',
  'autre'
);

CREATE TABLE conges (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  valideur_id UUID         REFERENCES users(id) ON DELETE SET NULL,
  type        conge_type   NOT NULL,
  date_debut  DATE         NOT NULL,
  date_fin    DATE         NOT NULL,
  statut      conge_statut NOT NULL DEFAULT 'en_attente',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT conge_dates_valides CHECK (date_fin >= date_debut)
);

SELECT create_updated_at_trigger('conges');

CREATE INDEX idx_conges_tenant        ON conges(tenant_id);
CREATE INDEX idx_conges_tenant_user   ON conges(tenant_id, user_id);
CREATE INDEX idx_conges_tenant_statut ON conges(tenant_id, statut);
CREATE INDEX idx_conges_periode       ON conges(tenant_id, date_debut, date_fin);

-- =============================================================================
-- 13. NOTES DE FRAIS
-- =============================================================================
CREATE TYPE note_frais_statut AS ENUM (
  'brouillon',
  'soumise',
  'approuvee',
  'refusee',
  'remboursee'
);

CREATE TABLE notes_frais (
  id               UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID              NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id          UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date             DATE              NOT NULL,
  montant          NUMERIC(10,2)     NOT NULL CHECK (montant > 0),
  categorie        TEXT              NOT NULL,
  justificatif_url TEXT,
  statut           note_frais_statut NOT NULL DEFAULT 'brouillon',
  created_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

SELECT create_updated_at_trigger('notes_frais');

CREATE INDEX idx_notes_frais_tenant        ON notes_frais(tenant_id);
CREATE INDEX idx_notes_frais_tenant_user   ON notes_frais(tenant_id, user_id);
CREATE INDEX idx_notes_frais_tenant_statut ON notes_frais(tenant_id, statut);
CREATE INDEX idx_notes_frais_date          ON notes_frais(tenant_id, date DESC);

-- =============================================================================
-- 14. CATALOGUE PRODUITS
-- =============================================================================
CREATE TABLE catalogue_produits (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ref         TEXT          NOT NULL,
  designation TEXT          NOT NULL,
  prix_ht     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (prix_ht >= 0),
  unite       TEXT          NOT NULL DEFAULT 'unité',
  categorie   TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, ref)
);

SELECT create_updated_at_trigger('catalogue_produits');

CREATE INDEX idx_catalogue_tenant          ON catalogue_produits(tenant_id);
CREATE INDEX idx_catalogue_tenant_categorie ON catalogue_produits(tenant_id, categorie);
CREATE INDEX idx_catalogue_designation_trgm ON catalogue_produits USING GIN (designation gin_trgm_ops);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Active RLS sur toutes les tables
ALTER TABLE tenants             ENABLE ROW LEVEL SECURITY;
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis               ENABLE ROW LEVEL SECURITY;
ALTER TABLE factures            ENABLE ROW LEVEL SECURITY;
ALTER TABLE projets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE dossiers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrats            ENABLE ROW LEVEL SECURITY;
ALTER TABLE interventions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sav_tickets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE taches              ENABLE ROW LEVEL SECURITY;
ALTER TABLE conges              ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes_frais         ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_produits  ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- HELPER RLS : récupère le tenant_id de l'utilisateur connecté
-- (auth.uid() est la fonction Supabase qui retourne l'UUID Supabase Auth)
-- =============================================================================
CREATE OR REPLACE FUNCTION auth_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================================================
-- POLICIES — pattern : un user accède uniquement aux données de son tenant
-- =============================================================================

-- tenants : un user voit uniquement son tenant
CREATE POLICY "tenant_isolation" ON tenants
  USING (id = auth_tenant_id());

-- Macro générique pour les tables avec tenant_id
-- (on déclare les policies explicitement pour chaque table)

-- users
CREATE POLICY "tenant_isolation" ON users
  USING (tenant_id = auth_tenant_id());

-- clients
CREATE POLICY "tenant_isolation" ON clients
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_insert" ON clients
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_update" ON clients
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_delete" ON clients
  USING (tenant_id = auth_tenant_id());

-- devis
CREATE POLICY "tenant_isolation" ON devis
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_insert" ON devis
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_update" ON devis
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_delete" ON devis
  USING (tenant_id = auth_tenant_id());

-- factures
CREATE POLICY "tenant_isolation" ON factures
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_insert" ON factures
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_update" ON factures
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_delete" ON factures
  USING (tenant_id = auth_tenant_id());

-- projets
CREATE POLICY "tenant_isolation" ON projets
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_insert" ON projets
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_update" ON projets
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_delete" ON projets
  USING (tenant_id = auth_tenant_id());

-- dossiers
CREATE POLICY "tenant_isolation" ON dossiers
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_insert" ON dossiers
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_update" ON dossiers
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_delete" ON dossiers
  USING (tenant_id = auth_tenant_id());

-- contrats
CREATE POLICY "tenant_isolation" ON contrats
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_insert" ON contrats
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_update" ON contrats
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_delete" ON contrats
  USING (tenant_id = auth_tenant_id());

-- interventions
CREATE POLICY "tenant_isolation" ON interventions
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_insert" ON interventions
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_update" ON interventions
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_delete" ON interventions
  USING (tenant_id = auth_tenant_id());

-- sav_tickets
CREATE POLICY "tenant_isolation" ON sav_tickets
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_insert" ON sav_tickets
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_update" ON sav_tickets
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_delete" ON sav_tickets
  USING (tenant_id = auth_tenant_id());

-- taches
CREATE POLICY "tenant_isolation" ON taches
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_insert" ON taches
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_update" ON taches
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_delete" ON taches
  USING (tenant_id = auth_tenant_id());

-- conges
CREATE POLICY "tenant_isolation" ON conges
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_insert" ON conges
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_update" ON conges
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_delete" ON conges
  USING (tenant_id = auth_tenant_id());

-- notes_frais
CREATE POLICY "tenant_isolation" ON notes_frais
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_insert" ON notes_frais
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_update" ON notes_frais
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_delete" ON notes_frais
  USING (tenant_id = auth_tenant_id());

-- catalogue_produits
CREATE POLICY "tenant_isolation" ON catalogue_produits
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_insert" ON catalogue_produits
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_update" ON catalogue_produits
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_delete" ON catalogue_produits
  USING (tenant_id = auth_tenant_id());

-- =============================================================================
-- SEED : tenant démo (optionnel, commenter en prod)
-- =============================================================================
-- INSERT INTO tenants (name, email) VALUES ('OxiFlow Démo', 'demo@oxiflow.fr');

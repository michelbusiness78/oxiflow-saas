-- =============================================================================
-- OxiFlow — Migration 015 : Module Projects R4
-- Nouvelle table "projects" (distinct de "projets" existant)
-- Table "project_notifications"
-- Colonnes project_created + project_id sur quotes
-- =============================================================================

-- ─── TABLE projects ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                TEXT          NOT NULL,
  description         TEXT,
  client_id           UUID          REFERENCES clients(id)  ON DELETE SET NULL,
  quote_id            UUID          REFERENCES quotes(id)   ON DELETE SET NULL,
  quote_number        VARCHAR(30),
  affair_number       VARCHAR(30),
  chef_projet_user_id UUID          REFERENCES users(id)    ON DELETE SET NULL,
  commercial_user_id  UUID          REFERENCES users(id)    ON DELETE SET NULL,
  amount_ttc          NUMERIC(12,2) NOT NULL DEFAULT 0,
  purchase_amount     NUMERIC(12,2),
  deadline            DATE,
  status              VARCHAR(20)   NOT NULL DEFAULT 'nouveau'
                                    CHECK (status IN ('nouveau', 'en_cours', 'termine', 'annule')),
  type                VARCHAR(50),
  notes               TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

SELECT create_updated_at_trigger('projects');

CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_quote  ON projects(quote_id);
CREATE INDEX IF NOT EXISTS idx_projects_chef   ON projects(chef_projet_user_id);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY projects_tenant_isolation ON projects
  USING (tenant_id = auth_tenant_id());

-- ─── TABLE project_notifications ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_notifications (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL,
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  type        VARCHAR(30) NOT NULL DEFAULT 'new_project',
  title       TEXT        NOT NULL,
  message     TEXT,
  read        BOOLEAN     NOT NULL DEFAULT false,
  accepted    BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_notifs_user ON project_notifications(user_id, read);

ALTER TABLE project_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_notifs_tenant_isolation ON project_notifications
  USING (tenant_id = auth_tenant_id());

-- ─── QUOTES : lien vers le projet créé ────────────────────────────────────────
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS project_created BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS project_id      UUID    REFERENCES projects(id) ON DELETE SET NULL;

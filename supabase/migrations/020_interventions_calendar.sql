-- =============================================================================
-- Migration 020 — Colonnes calendrier pour la table interventions
-- =============================================================================
-- La table interventions existe déjà (004, 008).
-- On ajoute les colonnes nécessaires au nouveau système de calendrier partagé.
-- Les anciennes colonnes (date, statut, technicien_id) sont conservées
-- pour compatibilité avec le module Technicien.

ALTER TABLE interventions
  ADD COLUMN IF NOT EXISTS title        TEXT,
  ADD COLUMN IF NOT EXISTS date_start   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS date_end     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS project_id   UUID REFERENCES projects(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tech_user_id UUID REFERENCES users(id)     ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tech_name    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS status       VARCHAR(20) DEFAULT 'planifiee',
  ADD COLUMN IF NOT EXISTS company_id   UUID,
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT now();

-- ── Backfill depuis les anciennes colonnes ────────────────────────────────────

UPDATE interventions
SET title = COALESCE(type::text, 'Intervention')
WHERE title IS NULL;

UPDATE interventions
SET date_start = CASE
  WHEN date IS NOT NULL THEN (date::text || 'T08:00:00+00:00')::timestamptz
  ELSE created_at
END
WHERE date_start IS NULL;

UPDATE interventions
SET status = COALESCE(statut, 'planifiee')
WHERE status IS NULL;

UPDATE interventions
SET tech_user_id = technicien_id
WHERE tech_user_id IS NULL AND technicien_id IS NOT NULL;

-- ── Index ──────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_interventions_tenant  ON interventions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_interventions_date    ON interventions(date_start);
CREATE INDEX IF NOT EXISTS idx_interventions_tech    ON interventions(tech_user_id);
CREATE INDEX IF NOT EXISTS idx_interventions_project ON interventions(project_id);

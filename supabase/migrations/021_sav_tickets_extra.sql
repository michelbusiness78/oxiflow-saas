-- =============================================================================
-- Migration 021 — Champs supplémentaires pour sav_tickets
-- =============================================================================

-- Lien vers un projet + notes de résolution
ALTER TABLE sav_tickets
  ADD COLUMN IF NOT EXISTS project_id        UUID REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolution_notes  TEXT;

CREATE INDEX IF NOT EXISTS idx_sav_project
  ON sav_tickets(project_id) WHERE project_id IS NOT NULL;

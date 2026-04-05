-- =============================================================================
-- Migration 022 — Colonnes manquantes sur sav_tickets
-- Consolide les ajouts des migrations 003 et 021 qui n'ont pas été appliquées.
-- À exécuter dans Supabase → SQL Editor.
-- =============================================================================

ALTER TABLE sav_tickets
  ADD COLUMN IF NOT EXISTS titre             TEXT,
  ADD COLUMN IF NOT EXISTS assigne_a         UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id        UUID REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolution_notes  TEXT;

CREATE INDEX IF NOT EXISTS idx_sav_assigne
  ON sav_tickets(tenant_id, assigne_a);

CREATE INDEX IF NOT EXISTS idx_sav_project
  ON sav_tickets(project_id) WHERE project_id IS NOT NULL;

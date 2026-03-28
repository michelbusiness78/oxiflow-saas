-- =============================================================================
-- Migration 003 — Champs supplémentaires pour le module Projets
-- =============================================================================

-- Projets : type de projet, montant prévu, lien facture
ALTER TABLE projets
  ADD COLUMN IF NOT EXISTS type_projet TEXT,
  ADD COLUMN IF NOT EXISTS montant_ht  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS facture_id  UUID REFERENCES factures(id) ON DELETE SET NULL;

-- Tâches : description longue
ALTER TABLE taches
  ADD COLUMN IF NOT EXISTS description TEXT;

-- SAV tickets : titre court + technicien assigné
ALTER TABLE sav_tickets
  ADD COLUMN IF NOT EXISTS titre      TEXT,
  ADD COLUMN IF NOT EXISTS assigne_a  UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sav_assigne ON sav_tickets(tenant_id, assigne_a);

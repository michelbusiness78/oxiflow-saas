-- =============================================================================
-- Migration 004 — Champs supplémentaires pour le module Technicien
-- =============================================================================

ALTER TABLE interventions
  ADD COLUMN IF NOT EXISTS checklist     JSONB   NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS materiel      JSONB   NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS signature_url TEXT,
  ADD COLUMN IF NOT EXISTS adresse       TEXT;

-- Bucket Supabase Storage (à créer via Dashboard ou API)
-- Nom : "interventions"
-- Public : true (pour accès aux photos/signatures par URL)
-- Policies RLS storage recommandées :
--   INSERT : auth.role() = 'authenticated'
--   SELECT : true (public)
--   DELETE : auth.uid()::text = (storage.foldername(name))[1]

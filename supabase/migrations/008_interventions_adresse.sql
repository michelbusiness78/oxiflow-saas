-- =============================================================================
-- Migration 008 — Colonnes adresse pour le module Technicien / Interventions
-- =============================================================================
-- Ces colonnes complètent la migration 004 qui n'a pas toujours été appliquée
-- sur le Supabase distant. IF NOT EXISTS garantit l'idempotence.

ALTER TABLE interventions
  ADD COLUMN IF NOT EXISTS adresse     TEXT,
  ADD COLUMN IF NOT EXISTS code_postal TEXT,
  ADD COLUMN IF NOT EXISTS ville       TEXT;

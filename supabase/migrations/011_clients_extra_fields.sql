-- Migration 011 — Champs supplémentaires table clients
-- À exécuter dans Supabase SQL Editor

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS siret               VARCHAR(14),
  ADD COLUMN IF NOT EXISTS tva_intra           VARCHAR(20),
  ADD COLUMN IF NOT EXISTS conditions_paiement TEXT,
  ADD COLUMN IF NOT EXISTS actif               BOOLEAN NOT NULL DEFAULT true;

-- Index pour filtrer les clients actifs
CREATE INDEX IF NOT EXISTS idx_clients_tenant_actif ON clients(tenant_id, actif);

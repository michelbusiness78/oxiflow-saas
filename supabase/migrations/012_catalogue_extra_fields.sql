-- =============================================================================
-- Migration 012 — Catalogue : fournisseur, catégorie, type forfait, unite libre
-- À exécuter dans Supabase SQL Editor
-- =============================================================================

-- 1. Nouvelles colonnes
ALTER TABLE catalogue
  ADD COLUMN IF NOT EXISTS fournisseur   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS categorie     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS imported_from TEXT;

-- 2. Contrainte type : ajouter 'forfait' aux valeurs autorisées
ALTER TABLE catalogue DROP CONSTRAINT IF EXISTS catalogue_type_check;
ALTER TABLE catalogue ADD CONSTRAINT catalogue_type_check
  CHECK (type IN ('materiel', 'service', 'main_oeuvre', 'fourniture', 'forfait'));

-- 3. Supprimer la contrainte CHECK sur unite (passer en texte libre)
ALTER TABLE catalogue DROP CONSTRAINT IF EXISTS catalogue_unite_check;

-- 4. Contrainte unique (tenant_id, ref) pour éviter les doublons de référence
--    Nécessaire pour le ON CONFLICT du seed ci-dessous
ALTER TABLE catalogue DROP CONSTRAINT IF EXISTS uq_catalogue_tenant_ref;
ALTER TABLE catalogue
  ADD CONSTRAINT uq_catalogue_tenant_ref UNIQUE (tenant_id, ref)
  DEFERRABLE INITIALLY DEFERRED;

-- 5. Index sur actif pour les filtres fréquents
CREATE INDEX IF NOT EXISTS idx_catalogue_tenant ON catalogue(tenant_id, actif);

-- =============================================================================
-- DONNÉES DE DÉMONSTRATION (premier tenant uniquement)
-- =============================================================================
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants ORDER BY created_at LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'Aucun tenant trouvé — seed ignoré.';
    RETURN;
  END IF;

  INSERT INTO catalogue (tenant_id, ref, designation, fournisseur, categorie, type, prix_achat, prix_vente, unite, tva, actif)
  VALUES
    (v_tenant_id, 'CAMERA1250',  'Caméra dôme IP 5MP',         'Axis',      'Caméra',        'materiel', 280.00, 350.00, 'unité',   20.0, true),
    (v_tenant_id, 'NIRC4',       'Caméra IR extérieure 4MP',   'Hikvision', 'Caméra',        'materiel', 320.00, 480.00, 'unité',   20.0, true),
    (v_tenant_id, 'SW24P',       'Switch PoE 24 ports',        'Cisco',     'Switch',        'materiel', 450.00, 620.00, 'unité',   20.0, true),
    (v_tenant_id, 'CAB-CAT6',    'Câble Cat6 FTP',             'Général',   'Câble',         'materiel',   0.80,   1.50, 'mètre',   20.0, true),
    (v_tenant_id, 'MO-TECH',     'Main d''œuvre technicien',   NULL,        'Main d''œuvre', 'service',   NULL,  55.00, 'heure',   20.0, true),
    (v_tenant_id, 'FORFAIT-MES', 'Forfait mise en service',    NULL,        'Prestation',    'forfait',   NULL, 350.00, 'forfait', 20.0, true)
  ON CONFLICT (tenant_id, ref) DO NOTHING;

  RAISE NOTICE 'Seed catalogue : 6 produits insérés pour le tenant %', v_tenant_id;
END $$;

-- ─── R9 : Gestion des utilisateurs et rôles ──────────────────────────────────

-- ─── Colonnes supplémentaires sur users ──────────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name       VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name        VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role             VARCHAR(30) DEFAULT 'commercial';
  -- valeurs : dirigeant | commercial | chef | technicien | assistante
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id       UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS commercial_code  VARCHAR(10);
  -- ex : "COM1", "COM2" — affiché sur les devis
ALTER TABLE users ADD COLUMN IF NOT EXISTS color            VARCHAR(7) DEFAULT '#2563eb';
  -- couleur de l'avatar
ALTER TABLE users ADD COLUMN IF NOT EXISTS active           BOOLEAN DEFAULT true;

-- ─── Index ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role, active);

-- ─── Seed optionnel — utilisateurs de test NOVATECH ──────────────────────────
-- Décommenter et adapter si le tenant NOVATECH existe.
--
-- DO $$
-- DECLARE
--   v_tenant_id UUID;
-- BEGIN
--   SELECT id INTO v_tenant_id FROM tenants WHERE name ILIKE '%NOVATECH%' LIMIT 1;
--   IF v_tenant_id IS NOT NULL THEN
--     UPDATE users
--       SET first_name = 'Thierry', last_name = 'Foute',
--           role = 'commercial', commercial_code = 'COM1', color = '#ea580c', active = true
--       WHERE tenant_id = v_tenant_id AND email ILIKE '%thierry%';
--     UPDATE users
--       SET first_name = 'Julie', last_name = 'Bono',
--           role = 'chef', commercial_code = 'CP01', color = '#2563eb', active = true
--       WHERE tenant_id = v_tenant_id AND email ILIKE '%julie%';
--   END IF;
-- END $$;

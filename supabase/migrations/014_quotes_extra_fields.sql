-- =============================================================================
-- OxiFlow — Migration 014 : Champs supplémentaires table quotes
-- affair_number, commercial_user_id, chef_projet_user_id, deposit_percent
-- =============================================================================

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS affair_number       TEXT,
  ADD COLUMN IF NOT EXISTS commercial_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chef_projet_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deposit_percent     NUMERIC(5,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_quotes_commercial  ON quotes(commercial_user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_chef_projet ON quotes(chef_projet_user_id);

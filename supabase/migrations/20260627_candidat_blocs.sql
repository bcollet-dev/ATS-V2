ALTER TABLE candidates ADD COLUMN IF NOT EXISTS previous_establishment text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS legal_rep_first_name text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS legal_rep_last_name text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS legal_rep_link text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS legal_rep_phone text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS legal_rep_email text;

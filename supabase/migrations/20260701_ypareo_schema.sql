-- Ypareo integration: company contact fields + master birth name
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE needs ADD COLUMN IF NOT EXISTS master_birth_name text;

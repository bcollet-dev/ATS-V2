ALTER TABLE needs
  ADD COLUMN IF NOT EXISTS contract_conclusion_date date,
  ADD COLUMN IF NOT EXISTS contract_practical_start_date date,
  ADD COLUMN IF NOT EXISTS master_diploma text,
  ADD COLUMN IF NOT EXISTS master_diploma_level text;

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS situation_before_contract text,
  ADD COLUMN IF NOT EXISTS last_prepared_diploma text,
  ADD COLUMN IF NOT EXISTS last_class_year text,
  ADD COLUMN IF NOT EXISTS last_diploma_title text,
  ADD COLUMN IF NOT EXISTS highest_diploma text;

ALTER TABLE needs
  ADD COLUMN IF NOT EXISTS contract_made_at text,
  ADD COLUMN IF NOT EXISTS rncp_code text;

ALTER TABLE needs
  ADD COLUMN IF NOT EXISTS remuneration_lines jsonb,
  ADD COLUMN IF NOT EXISTS monthly_gross_salary text,
  ADD COLUMN IF NOT EXISTS hourly_gross_salary text;

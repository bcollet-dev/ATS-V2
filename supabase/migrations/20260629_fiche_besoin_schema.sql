-- Nouveaux champs CERFA / maître d'apprentissage sur needs
ALTER TABLE needs
  ADD COLUMN IF NOT EXISTS master_first_name       text,
  ADD COLUMN IF NOT EXISTS master_last_name        text,
  ADD COLUMN IF NOT EXISTS master_birth_date       date,
  ADD COLUMN IF NOT EXISTS master_job_title        text,
  ADD COLUMN IF NOT EXISTS master_phone            text,
  ADD COLUMN IF NOT EXISTS master_email            text,
  ADD COLUMN IF NOT EXISTS weekly_hours            text,
  ADD COLUMN IF NOT EXISTS contract_type           text,
  ADD COLUMN IF NOT EXISTS salary_reference        text,
  ADD COLUMN IF NOT EXISTS smc_amount              text,
  ADD COLUMN IF NOT EXISTS overtime_handling       text,
  ADD COLUMN IF NOT EXISTS end_date                date,
  ADD COLUMN IF NOT EXISTS benefit_food            text,
  ADD COLUMN IF NOT EXISTS benefit_housing         text,
  ADD COLUMN IF NOT EXISTS benefit_other           text;

-- Table de jointure need_cursus (many-to-many, sans ordre)
CREATE TABLE IF NOT EXISTS need_cursus (
  need_id    uuid NOT NULL REFERENCES needs(id)   ON DELETE CASCADE,
  cursus_id  uuid NOT NULL REFERENCES cursus(id)  ON DELETE CASCADE,
  PRIMARY KEY (need_id, cursus_id)
);

-- Migration des données : copier target_cursus_id vers need_cursus
INSERT INTO need_cursus (need_id, cursus_id)
SELECT id, target_cursus_id
FROM needs
WHERE target_cursus_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Nouveaux champs contractuels FRE/CERFA sur companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS idcc                   text,
  ADD COLUMN IF NOT EXISTS collective_agreement   text,
  ADD COLUMN IF NOT EXISTS opco                   text,
  ADD COLUMN IF NOT EXISTS retirement_fund        text,
  ADD COLUMN IF NOT EXISTS provident_fund         text,
  ADD COLUMN IF NOT EXISTS legal_rep_first_name   text,
  ADD COLUMN IF NOT EXISTS legal_rep_last_name    text;

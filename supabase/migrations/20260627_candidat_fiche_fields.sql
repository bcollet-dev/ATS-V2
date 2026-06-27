-- Champs manquants pour le CERFA côté candidat et le suivi
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS nationality text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS birth_department text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS social_regime text;

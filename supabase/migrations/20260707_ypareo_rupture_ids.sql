-- Slice 01 : stockage des IDs Ypareo (contrat + inscription) sur le matching winner
-- Renseignés après un push Ypareo réussi, nécessaires pour les actions rupture/abandon.

ALTER TABLE matchings
  ADD COLUMN IF NOT EXISTS ypareo_contrat_id    text,
  ADD COLUMN IF NOT EXISTS ypareo_inscription_id text;

-- Colonne deadline 6 mois sur candidat (utilisée par slice 03 pour les ruptures
-- où le candidat reste en formation)
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS rupture_recherche_deadline date;

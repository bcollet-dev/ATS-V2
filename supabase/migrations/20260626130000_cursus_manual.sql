-- external_id était NOT NULL car prévu pour l'import Ypareo.
-- Les cursus créés manuellement n'ont pas d'ID Ypareo : on rend la colonne nullable.
-- Les futures syncs Ypareo alimenteront external_id ; la contrainte UNIQUE tient
-- (PostgreSQL ignore les NULL dans les index uniques, donc plusieurs lignes
-- manuelles avec external_id NULL coexistent sans conflit).

ALTER TABLE cursus ALTER COLUMN external_id DROP NOT NULL;
ALTER TABLE classes ALTER COLUMN external_id DROP NOT NULL;

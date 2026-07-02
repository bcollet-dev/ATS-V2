-- Ajoute class_id sur matchings pour lier un placement à une classe Ypareo
ALTER TABLE matchings
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES classes(id) ON DELETE SET NULL;

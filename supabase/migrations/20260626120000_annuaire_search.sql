-- Extension trigrammes pour ILIKE rapide sur grandes tables
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Champ formation visée sur les candidats (texte libre, sera mappé Ypareo plus tard)
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cursus_envisage text;

-- Index GIN trigrammes pour les 3 entités searchables de l'Annuaire
CREATE INDEX IF NOT EXISTS candidates_search_trgm_idx ON candidates USING gin (
  (coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(phone,'') || ' ' || coalesce(cursus_envisage,''))
  gin_trgm_ops
);

CREATE INDEX IF NOT EXISTS companies_search_trgm_idx ON companies USING gin (
  (coalesce(name,'') || ' ' || coalesce(siret,'') || ' ' || coalesce(city,''))
  gin_trgm_ops
);

CREATE INDEX IF NOT EXISTS company_contacts_search_trgm_idx ON company_contacts USING gin (
  (coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(phone,''))
  gin_trgm_ops
);

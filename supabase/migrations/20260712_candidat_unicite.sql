-- Durcissement de l'unicité côté base (le dédoublonnage applicatif reste, ceci
-- est une défense en profondeur contre les courses concurrentes).

-- Un seul candidat non supprimé par email (insensible à la casse).
-- Les emails NULL restent autorisés en multiple (NULL distinct en Postgres).
CREATE UNIQUE INDEX IF NOT EXISTS candidates_email_active_unique
  ON public.candidates (lower(email))
  WHERE deleted_at IS NULL AND email IS NOT NULL;
--> statement-breakpoint

-- Un seul document par type « upsert » (cv / cni / carte_vitale) par candidat.
-- Les diplômes et « other » peuvent rester multiples.
CREATE UNIQUE INDEX IF NOT EXISTS documents_candidate_upsert_type_unique
  ON public.documents (candidate_id, document_type)
  WHERE candidate_id IS NOT NULL
    AND document_type IN ('cv', 'cni', 'carte_vitale');

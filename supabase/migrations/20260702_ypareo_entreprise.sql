-- Référence de l'entité Entreprise dans Ypareo (find-or-create au push placement)
-- employeur.idEntreprise (uuid) du CERFA contrat-apprentissage : sans lui, Ypareo
-- rejette le POST avec Guid.Empty ("L'identifiant du type Entreprise est non renseigné").
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ypareo_entreprise_id text;

-- Type d'employeur CERFA (code entier 11–30 ; défaut 12 = entreprise inscrite au RCS).
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ypareo_type_employeur integer DEFAULT 12;

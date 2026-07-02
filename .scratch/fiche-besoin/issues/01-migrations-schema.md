# 01 — Migrations schéma

Status: done

## What to build

Ajouter tous les nouveaux champs de base de données nécessaires à la fiche besoin, en une seule migration cohérente.

**Table `needs` — 15 nouveaux champs :**

```
-- Maître d'apprentissage
masterFirstName      text
masterLastName       text
masterBirthDate      date
masterJobTitle       text
masterPhone          text
masterEmail          text

-- Contrat
weeklyHours          text         -- ex. "35"
contractType         text         -- "apprentissage" | "professionnalisation" | "cdi" | "cdd"
salaryReference      text         -- "SMIC" | "SMC"
smcAmount            text         -- montant brut mensuel si SMC
overtimeHandling     text         -- "payées" | "récupérées"
endDate              date

-- Avantages en nature
benefitFood          text         -- €/repas
benefitHousing       text         -- €/mois
benefitOther         text
```

**Nouvelle table `need_cursus` (many-to-many, sans ordre) :**

```
need_cursus (
  needId   uuid FK → needs.id    NOT NULL ON DELETE CASCADE
  cursusId uuid FK → cursus.id   NOT NULL ON DELETE CASCADE
  PRIMARY KEY (needId, cursusId)
)
```

Inclut une migration de données qui copie les valeurs existantes de `needs.targetCursusId` vers `need_cursus` (une ligne par besoin ayant un `targetCursusId` non-null). `needs.targetCursusId` est conservé en base après cette migration (sera supprimé dans un chantier ultérieur).

**Table `companies` — 7 nouveaux champs :**

```
idcc                 text   -- Code IDCC convention collective
collectiveAgreement  text   -- Libellé convention collective
opco                 text   -- Nom OPCO/OPCA
retirementFund       text   -- Caisse de retraite complémentaire
providentFund        text   -- Organisme de prévoyance
legalRepFirstName    text   -- Représentant légal (prénom)
legalRepLastName     text   -- Représentant légal (nom)
```

Toutes les colonnes sont nullables (aucune valeur de défaut requise). Migration Drizzle (schema + `drizzle-kit generate`) + SQL appliqué via Supabase MCP.

## Acceptance criteria

- [ ] Les 15 nouveaux champs apparaissent dans `needs` en base (vérifiable via `SELECT column_name FROM information_schema.columns WHERE table_name = 'needs'`)
- [ ] La table `need_cursus` existe avec sa clé primaire composite et ses FK
- [ ] Les données existantes de `needs.targetCursusId` ont été copiées vers `need_cursus` (zéro perte de données)
- [ ] Les 7 nouveaux champs apparaissent dans `companies`
- [ ] Le schéma Drizzle (`src/db/schema/`) reflète tous les changements
- [ ] `npx tsc --noEmit` passe sans nouvelles erreurs

## Blocked by

None — can start immediately.

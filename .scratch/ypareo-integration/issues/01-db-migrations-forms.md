# 01 — Migrations DB + mise à jour formulaires

Status: done

## Parent

`.scratch/ypareo-integration/PRD.md`

## What to build

Ajouter trois colonnes manquantes pour satisfaire les champs requis par Ypareo, et mettre à jour les formulaires de saisie correspondants.

**Migration Drizzle :**
- `companies.phone` (text, nullable)
- `companies.email` (text, nullable)
- `needs.master_birth_name` (text, nullable)

**Formulaires à mettre à jour :**
- Fiche entreprise (création + édition) : ajouter les champs Téléphone et Email dans la section coordonnées
- Fiche besoin — section maître d'apprentissage : ajouter le champ "Nom de naissance"

## Acceptance criteria

- [ ] Fichier de migration Drizzle créé et appliqué (`drizzle-kit generate` + `push`)
- [ ] Schéma Drizzle mis à jour (`src/db/schema/companies.ts` et `src/db/schema/needs.ts`)
- [ ] Formulaire fiche entreprise : champs `phone` et `email` visibles, sauvegardés, et affichés
- [ ] Formulaire fiche besoin : champ `masterBirthName` visible dans la section maître d'apprentissage, sauvegardé, et affiché
- [ ] Les nouveaux champs sont nullables — aucune donnée existante n'est affectée

## Blocked by

None — can start immediately.

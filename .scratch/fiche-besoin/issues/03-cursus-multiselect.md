# 03 — Cursus cibles multi-select

Status: done

## What to build

Remplacer la sélection mono-cursus par un bloc multi-select dans la colonne principale de la fiche besoin.

**BlocCursus :** Composant affiché dans la colonne principale, sous le drawer CERFA. Affiche les cursus actuellement sélectionnés sous forme de badges avec un bouton de suppression sur chacun. Un bouton "Ajouter un cursus" ouvre un popover avec un champ de recherche filtrant la liste complète des cursus Ypareo (table `cursus`). La sélection est à plat, sans ordre.

**Server action `syncNeedCursus(needId, cursusIds[])` :** Remplace la sélection complète — supprime les lignes `need_cursus` qui ne sont plus dans la liste, insère les nouvelles. Appelle `logActivityEvent` avec `actionType = "need_cursus_updated"` et un summary listant les cursus ajoutés/retirés.

La source de données est la table `need_cursus` (introduite en tranche 01). L'ancien champ `targetCursusId` sur `needs` n'est plus affiché ni écrit.

## Acceptance criteria

- [ ] `BlocCursus` affiche les cursus sélectionnés sous forme de badges dans la colonne principale
- [ ] Le popover de sélection filtre la liste cursus Ypareo en temps réel
- [ ] Ajouter un cursus met à jour `need_cursus` en base (nouvelle ligne)
- [ ] Retirer un cursus supprime la ligne correspondante dans `need_cursus`
- [ ] Un événement `need_cursus_updated` est loggé dans `activity_events` à chaque modification
- [ ] `npx tsc --noEmit` passe sans nouvelles erreurs

## Blocked by

- `.scratch/fiche-besoin/issues/01-migrations-schema.md`
- `.scratch/fiche-besoin/issues/02-layout-cerfa-drawer.md`

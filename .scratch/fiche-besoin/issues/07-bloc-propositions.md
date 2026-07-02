# 07 — BlocPropositions dans le nouveau layout

Status: done

## What to build

Intégrer le composant `BlocPropositions` existant dans le nouveau layout à deux colonnes, et y brancher `logActivityEvent` pour que les actions sur les candidats proposés apparaissent dans l'historique.

**Intégration layout :** `BlocPropositions` est rendu dans la colonne principale, après `BlocCursus` et avant `BlocTaches`. Aucune modification fonctionnelle du composant existant n'est requise — il s'agit uniquement de l'insérer dans le bon slot du layout.

**Branchement historique :** Les server actions existantes de `BlocPropositions` (ajout de candidat, retrait, changement de statut de proposition) doivent appeler `logActivityEvent` à chaque mutation :
- Ajout d'un candidat → `actionType: "matching_added"`, summary : "Candidat [Prénom Nom] ajouté à la proposition"
- Retrait d'un candidat → `actionType: "matching_removed"`, summary : "Candidat [Prénom Nom] retiré de la proposition"
- Changement de statut de proposition → `actionType: "matching_status_changed"`, summary : "Candidat [Prénom Nom] passé en [statut]"

L'utilitaire `logActivityEvent` est déjà disponible depuis la tranche 02.

## Acceptance criteria

- [ ] `BlocPropositions` s'affiche correctement dans la colonne principale du nouveau layout
- [ ] L'ajout d'un candidat au besoin logue un événement `matching_added` dans `activity_events`
- [ ] Le retrait d'un candidat logue un événement `matching_removed`
- [ ] Le changement de statut de proposition logue un événement `matching_status_changed`
- [ ] Aucune régression fonctionnelle sur les actions existantes de `BlocPropositions` (ajout avec recherche, refus, changement de statut)
- [ ] `npx tsc --noEmit` passe sans nouvelles erreurs

## Blocked by

- `.scratch/fiche-besoin/issues/02-layout-cerfa-drawer.md`

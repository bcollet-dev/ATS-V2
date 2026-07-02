Status: ready-for-agent

# 06 — BlocTaches sur la fiche entreprise

## Parent

`.scratch/fiche-entreprise/PRD.md`

## What to build

Ajouter un bloc "Tâches" en colonne principale de la fiche entreprise, sous le bloc Personnel. Même pattern que le bloc tâches de la fiche candidat : liste des tâches avec `companyId = id`, création inline avec `companyId` pré-rempli, marquage comme terminée, suppression.

Le rôle `direction` voit les tâches en lecture seule (pas de création ni modification).

## Acceptance criteria

- [ ] Le bloc "Tâches" s'affiche en colonne principale sous le bloc Personnel
- [ ] Les tâches affichées sont celles avec `companyId` correspondant à l'entreprise courante
- [ ] Les rôles non-`direction` peuvent créer une tâche inline (companyId pré-rempli)
- [ ] Les rôles non-`direction` peuvent marquer une tâche comme terminée et la supprimer
- [ ] Le rôle `direction` voit la liste en lecture seule
- [ ] "Aucune tâche" si la liste est vide

## Blocked by

None — can start immediately

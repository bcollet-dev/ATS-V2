# 05 — BlocTaches

Status: done

## What to build

Ajouter un bloc de gestion des tâches dans la colonne principale de la fiche besoin, en s'appuyant sur la table `tasks` existante (qui a déjà un champ `needId`).

**BlocTaches :** Composant affiché dans la colonne principale, après `BlocPropositions`. Affiche la liste des tâches liées au besoin (`tasks WHERE needId = :id AND deletedAt IS NULL ORDER BY dueAt ASC`), triées par date d'échéance. Chaque tâche affiche : titre, catégorie (badge), assigné, date d'échéance, et une case à cocher pour la compléter.

**Création rapide :** Formulaire inline (ou mini-drawer) avec les champs : titre (obligatoire), catégorie (sélecteur utilisant l'enum `taskCategory`), assigné (sélecteur parmi les profils), date d'échéance (date picker). La tâche est créée avec `needId` renseigné.

**Server actions :**
- `createNeedTask(needId, fields)` : crée la tâche, logue `task_created` dans `activityEvents`
- `completeTask(taskId)` : met à jour `completedAt` et `completedBy`, logue `task_completed`

## Acceptance criteria

- [ ] `BlocTaches` affiche la liste des tâches du besoin, triées par date d'échéance
- [ ] Le formulaire de création crée une tâche en base avec le `needId` correct
- [ ] Cocher une tâche met à jour `completedAt` et `completedBy` en base
- [ ] Les événements `task_created` et `task_completed` sont loggés dans `activity_events`
- [ ] `npx tsc --noEmit` passe sans nouvelles erreurs

## Blocked by

- `.scratch/fiche-besoin/issues/02-layout-cerfa-drawer.md`

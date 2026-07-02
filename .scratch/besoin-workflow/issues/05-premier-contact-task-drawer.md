# 05 — Tâche "Premier contact" obligatoire à la création d'un besoin

Status: ready-for-agent
Feature: besoin-workflow

## What to build

Le drawer de création de besoin doit inclure une section "Tâche de premier contact" séparée du reste du formulaire (séparateur visuel + titre de section). La tâche est créée atomiquement avec le besoin dans `createNeed`.

**Champs de la section tâche** :

| Champ | Défaut | Obligatoire |
|---|---|---|
| Catégorie | `call` (modifiable) | Non |
| Titre | "Premier contact" (modifiable) | Oui |
| Responsable (owner) | = recruteur besoin si renseigné | Oui |
| Deadline | vide | Non |
| Notes | vide | Non |

**Règle de pré-remplissage** : quand l'utilisateur sélectionne un recruteur dans la partie besoin, le champ "Responsable" de la tâche se synchronise, **sauf** si l'utilisateur a déjà modifié manuellement ce champ.

**Création atomique** : `createNeed` insère le besoin puis la tâche dans la même server action. Si l'insert tâche échoue, le besoin reste créé (pas de rollback — comportement acceptable).

## Acceptance criteria

- [ ] Le drawer affiche une section distincte "Tâche de premier contact"
- [ ] Le champ "Responsable" de la tâche est obligatoire (validation Zod + message d'erreur)
- [ ] Le champ "Titre" de la tâche est pré-rempli "Premier contact" et modifiable
- [ ] La catégorie est pré-sélectionnée sur "call" et modifiable
- [ ] La deadline est optionnelle (pas de validation si vide)
- [ ] Quand le recruteur besoin change, le responsable tâche se synchronise si l'utilisateur ne l'a pas manuellement modifié
- [ ] Après création, la tâche apparaît sur la fiche besoin (`/besoins/[id]`) — ou dans la section tâches si elle existe
- [ ] Après création, le toast de confirmation mentionne le besoin créé
- [ ] La soumission est bloquée si le responsable tâche est vide

## Blocked by

None — can start immediately.

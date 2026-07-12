# Guide — Tâches & notifications

## À quoi ça sert

Organiser le travail : créer des tâches (appels, relances, entretiens,
administratif…), les assigner, les suivre depuis le tableau de bord, et être
prévenu par notification et par le digest quotidien.

## Qui peut faire quoi

| Action | Qui |
|--------|-----|
| Créer une tâche | tout utilisateur |
| Terminer / rouvrir, modifier, supprimer une tâche | son **créateur**, son **assigné**, ou un **encadrant** (admin, direction, team_leader) |
| Lire ses notifications | chacun, pour soi |

Un utilisateur qui n'est ni créateur, ni assigné, ni encadrant **ne peut pas**
modifier ou supprimer la tâche d'un collègue — l'action est refusée.

## Créer une tâche

1. Onglet **Tâches** (ou depuis une fiche candidat/entreprise) → **Nouvelle tâche**.
2. Renseignez titre, catégorie, échéance, et rattachez au moins un candidat ou
   une entreprise. Choisissez l'assigné (vous par défaut).

**Ce que ça entraîne :**
- La tâche est créée et rattachée à l'entité (visible sur sa fiche).
- Un évènement est ajouté à l'**historique** de l'entité.
- Si vous l'assignez à **quelqu'un d'autre**, cette personne reçoit une
  **notification**.

## Suivre ses tâches

- **Widget « Mes tâches »** (tableau de bord) : toutes vos tâches ouvertes, y
  compris **à venir** (ex. un entretien planifié demain y figure), triées par échéance.
- **Widget « Relances en retard »** : les tâches dont l'échéance est **dépassée**
  (vue personnelle ou équipe pour l'encadrement).

## Actions sur une tâche et leurs effets

| Action | Ce que ça entraîne |
|--------|--------------------|
| **Terminer** | Marque la tâche faite (date + auteur), la retire des listes ouvertes, trace « terminée » dans l'historique. |
| **Rouvrir** | Repasse la tâche en ouverte, trace « rouverte ». |
| **Modifier l'assigné** | Réassigne la tâche **et notifie** le nouvel assigné. |
| **Modifier échéance / titre / catégorie** | Met à jour la tâche, trace « modifiée ». |
| **Supprimer** | Suppression douce (récupérable en base), trace « supprimée ». |

## Notifications

- La cloche affiche vos notifications (tâche assignée, entretien assigné…).
- **Ouvrir la cloche marque tout comme lu.** Si une notification arrive pendant
  que vous consultez, elle peut être marquée lue : reparcourez la liste au besoin.

## Digest quotidien (email automatique, ~6 h)

Chaque matin, chaque utilisateur actif ayant des tâches ouvertes reçoit un
récapitulatif par email.

**Bon à savoir :**
- L'envoi est **résilient** : si l'email d'un collègue échoue, les autres partent
  quand même, et le digest **n'est pas renvoyé en double**.
- Les **tâches orphelines** (dont l'assigné a quitté / été désactivé) ne
  disparaissent pas : elles remontent dans le digest de la **direction / admin**
  pour être réattribuées.

## Points d'attention

- Assigner une tâche à un compte **désactivé** la rend invisible pour cette
  personne : préférez un collègue actif ; sinon la direction la verra via le digest.
- La suppression est douce : en cas d'erreur, un administrateur peut la restaurer.

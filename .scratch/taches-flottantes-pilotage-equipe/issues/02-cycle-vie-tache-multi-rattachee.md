# Gerer le cycle de vie d'une tache multi-rattachee

Status: ready-for-agent
Feature: taches-flottantes-pilotage-equipe

## Parent

.scratch/taches-flottantes-pilotage-equipe/PRD.md

## What to build

Faire fonctionner les actions de cycle de vie sur une tache multi-rattachee : terminer, rouvrir, modifier et supprimer. Chaque action doit porter sur la tache unique partagee, conserver les rattachements, et ecrire l'historique sur chaque candidat et entreprise rattache.

Cette tranche rend le statut global fiable : terminer une tache depuis une surface la termine partout.

## Acceptance criteria

- [ ] Terminer une tache multi-rattachee met a jour une seule tache partagee.
- [ ] Rouvrir une tache multi-rattachee met a jour une seule tache partagee.
- [ ] Modifier le titre, la categorie, l'echeance, le proprietaire ou la note conserve les rattachements existants.
- [ ] Supprimer une tache la retire des vues globales et des fiches rattachees sans supprimer les candidats ou entreprises.
- [ ] La creation d'une tache ecrit un evenement d'historique pour chaque candidat et entreprise rattache.
- [ ] La modification d'une tache ecrit un evenement d'historique pour chaque candidat et entreprise rattache quand le changement est pertinent.
- [ ] La cloture, la reouverture et la suppression ecrivent un evenement d'historique pour chaque candidat et entreprise rattache.
- [ ] Les historiques restent comprehensibles quand une tache apparait sur plusieurs fiches.
- [ ] Les notifications existantes continuent de fonctionner pour les taches assignees a un autre utilisateur.
- [ ] Le build passe apres adaptation des actions de mise a jour et suppression.

## Blocked by

- .scratch/taches-flottantes-pilotage-equipe/issues/01-creer-tache-multi-rattachee.md

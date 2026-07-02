# Afficher le bloc pilotage equipe en haut de Taches

Status: ready-for-agent
Feature: taches-flottantes-pilotage-equipe

## Parent

.scratch/taches-flottantes-pilotage-equipe/PRD.md

## What to build

Afficher directement en haut de l'onglet Taches un bloc de pilotage equipe pour les roles direction, admin et team_leader. Le bloc doit aider a agir sur le travail ouvert : taches en retard, taches non assignees, taches dues aujourd'hui et charge par proprietaire.

Le bloc reste compact et operationnel. Il ne doit pas devenir un tableau analytique ou un recapitulatif complet de l'historique.

## Acceptance criteria

- [ ] Les roles direction, admin et team_leader voient le bloc pilotage directement en haut de la page Taches.
- [ ] Les utilisateurs standard ne voient pas le bloc pilotage equipe.
- [ ] Le bloc affiche le total des taches ouvertes.
- [ ] Le bloc affiche le nombre de taches en retard.
- [ ] Le bloc affiche le nombre de taches non assignees.
- [ ] Le bloc affiche le nombre de taches dues aujourd'hui.
- [ ] Le bloc affiche une carte compacte par proprietaire interne ayant des taches ouvertes.
- [ ] Chaque carte proprietaire affiche les taches ouvertes, en retard, aujourd'hui/demain et la prochaine echeance.
- [ ] Une carte Non assignees apparait en premier quand des taches ouvertes n'ont pas de proprietaire.
- [ ] Cliquer une carte proprietaire filtre la liste de taches dessous sur ce proprietaire.
- [ ] Cliquer la carte Non assignees filtre la liste dessous sur les taches non assignees.
- [ ] Les taches terminees ne sont pas comptees comme charge ouverte dans le bloc.
- [ ] Les taches supprimees sont exclues du bloc.
- [ ] Le bloc fonctionne avec les rattachements multiples sans dupliquer les compteurs.
- [ ] Le build passe avec le bloc visible et les filtres connectes.

## Blocked by

- .scratch/taches-flottantes-pilotage-equipe/issues/01-creer-tache-multi-rattachee.md
- .scratch/taches-flottantes-pilotage-equipe/issues/02-cycle-vie-tache-multi-rattachee.md

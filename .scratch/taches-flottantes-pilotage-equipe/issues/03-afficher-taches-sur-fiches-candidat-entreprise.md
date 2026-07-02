# Afficher les taches multi-rattachees sur les fiches candidat et entreprise

Status: ready-for-agent
Feature: taches-flottantes-pilotage-equipe

## Parent

.scratch/taches-flottantes-pilotage-equipe/PRD.md

## What to build

Adapter les blocs Taches des fiches candidat et entreprise pour lire le nouveau modele de rattachement. Une tache rattachee a un candidat et a une entreprise doit apparaitre sur les deux fiches, avec un statut unique et les memes actions de consultation ou de cycle de vie.

Les blocs existants restent des surfaces de consultation/action en V1. Ils ne doivent pas devenir un second systeme divergent de creation de taches.

## Acceptance criteria

- [ ] La fiche candidat affiche les taches rattachees au candidat via les nouveaux liens de tache.
- [ ] La fiche entreprise affiche les taches rattachees a l'entreprise via les nouveaux liens de tache.
- [ ] Une tache rattachee a Candidat 1 et Entreprise X apparait sur la fiche du candidat et sur la fiche de l'entreprise.
- [ ] Terminer une tache depuis une fiche met a jour le statut visible sur l'autre fiche apres revalidation/rafraichissement.
- [ ] Rouvrir une tache depuis une fiche met a jour le statut visible sur l'autre fiche apres revalidation/rafraichissement.
- [ ] Les blocs affichent les autres rattachements de la tache de maniere compacte et lisible.
- [ ] Les liens vers les fiches rattachees fonctionnent depuis le detail de tache quand ils sont exposes.
- [ ] La creation locale existante est retiree, masquee ou branchee sur la meme action de creation multi-rattachement.
- [ ] Les anciens champs directs candidat/entreprise ne sont plus utilises comme source de verite applicative.
- [ ] Le build passe avec les fiches candidat et entreprise.

## Blocked by

- .scratch/taches-flottantes-pilotage-equipe/issues/01-creer-tache-multi-rattachee.md
- .scratch/taches-flottantes-pilotage-equipe/issues/02-cycle-vie-tache-multi-rattachee.md

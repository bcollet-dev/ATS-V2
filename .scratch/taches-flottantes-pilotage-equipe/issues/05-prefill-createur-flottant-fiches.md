# Preremplir le createur flottant depuis les fiches

Status: ready-for-agent
Feature: taches-flottantes-pilotage-equipe

## Parent

.scratch/taches-flottantes-pilotage-equipe/PRD.md

## What to build

Rendre le createur flottant contextuel sur les fiches candidat et entreprise. Quand l'utilisateur ouvre le createur depuis une fiche candidat, le candidat courant est deja rattache. Quand il l'ouvre depuis une fiche entreprise, l'entreprise courante est deja rattachee.

L'utilisateur peut ensuite ajouter d'autres candidats ou entreprises avant de creer la tache.

## Acceptance criteria

- [ ] Depuis une fiche candidat, ouvrir le createur ajoute automatiquement le candidat courant comme rattachement.
- [ ] Depuis une fiche entreprise, ouvrir le createur ajoute automatiquement l'entreprise courante comme rattachement.
- [ ] Le rattachement automatique est visible sous forme de pastille avant creation.
- [ ] L'utilisateur peut ajouter d'autres candidats ou entreprises en plus du rattachement automatique.
- [ ] L'utilisateur ne peut pas creer de doublon du meme rattachement.
- [ ] Fermer puis rouvrir le createur depuis la meme fiche restaure le contexte courant proprement.
- [ ] Naviguer vers une autre fiche met a jour le contexte utilise par le createur.
- [ ] Depuis une page sans contexte, le createur conserve le comportement sans rattachement initial.
- [ ] Une tache creee depuis une fiche apparait ensuite sur cette fiche via le nouveau modele.
- [ ] Le build passe avec le contexte candidat/entreprise branche dans les pages concernees.

## Blocked by

- .scratch/taches-flottantes-pilotage-equipe/issues/04-createur-flottant-global-sans-contexte.md

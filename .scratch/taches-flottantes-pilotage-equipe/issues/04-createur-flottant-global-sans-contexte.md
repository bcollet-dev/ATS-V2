# Ajouter le createur flottant global sans contexte

Status: ready-for-agent
Feature: taches-flottantes-pilotage-equipe

## Parent

.scratch/taches-flottantes-pilotage-equipe/PRD.md

## What to build

Ajouter un bouton flottant de creation de tache dans l'application authentifiee. Dans cette tranche, le createur fonctionne depuis toutes les pages sans supposer de contexte candidat ou entreprise. L'utilisateur peut rechercher et ajouter des rattachements, puis creer une tache avec le meme modele multi-rattachement que l'onglet Taches.

Le createur flottant est un createur uniquement : il ne liste pas les taches et ne devient pas une deuxieme page Taches.

## Acceptance criteria

- [ ] Chaque utilisateur connecte voit un bouton flottant discret de creation de tache dans l'application.
- [ ] Le createur peut etre ouvert et ferme sans perdre le fonctionnement de la page courante.
- [ ] Le createur contient les champs titre, categorie, echeance, proprietaire, note et rattachements externes.
- [ ] Le proprietaire par defaut est l'utilisateur connecte.
- [ ] L'echeance par defaut est demain.
- [ ] La creation reste bloquee tant qu'aucun candidat ou entreprise n'est rattache.
- [ ] L'utilisateur peut rechercher et ajouter plusieurs candidats et entreprises.
- [ ] L'utilisateur peut retirer un rattachement avant creation.
- [ ] Selectionner un contact dans la recherche ajoute son entreprise.
- [ ] Creer une tache depuis le createur flottant produit le meme resultat observable qu'une creation depuis l'onglet Taches.
- [ ] Le createur se remet dans un etat propre apres creation ou fermeture.
- [ ] Le build passe avec le createur rendu dans l'application authentifiee.

## Blocked by

- .scratch/taches-flottantes-pilotage-equipe/issues/01-creer-tache-multi-rattachee.md

# Creer une tache multi-rattachee depuis Taches

Status: ready-for-agent
Feature: taches-flottantes-pilotage-equipe

## Parent

.scratch/taches-flottantes-pilotage-equipe/PRD.md

## What to build

Permettre de creer une tache depuis l'onglet Taches avec un proprietaire interne unique et plusieurs rattachements externes candidat/entreprise. Cette tranche pose le nouveau modele de rattachement, la validation "au moins un rattachement", la recherche candidat/entreprise/contact, et un affichage minimal des rattachements dans la liste globale des taches.

La tache reste une seule action partagee. Les contacts ne sont pas des rattachements durables : les rechercher sert uniquement a retrouver et rattacher leur entreprise.

## Acceptance criteria

- [ ] Une tache peut etre creee depuis l'onglet Taches avec un titre, une categorie, une echeance, un proprietaire interne et une note optionnelle.
- [ ] Une tache peut etre rattachee a un candidat, une entreprise, plusieurs candidats, plusieurs entreprises, ou un melange candidat/entreprise.
- [ ] La creation sans candidat ni entreprise est bloquee avec un message comprehensible.
- [ ] Les rattachements sont stockes dans une table dediee et unique par tache/type/entite.
- [ ] La recherche de rattachement retourne les candidats, les entreprises et les contacts.
- [ ] Selectionner un contact rattache son entreprise, pas le contact lui-meme.
- [ ] La page Taches affiche les rattachements d'une tache sans dupliquer la tache en plusieurs lignes/cartes.
- [ ] Les vues compactes affichent les premiers rattachements puis un indicateur `+N` quand il y en a trop.
- [ ] Assigner la tache a un autre utilisateur continue de creer une notification.
- [ ] Le build passe apres migration du schema et mise a jour des usages principaux.

## Blocked by

None - can start immediately

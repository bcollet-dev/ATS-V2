# Retirer le modele tache lie aux besoins

Status: ready-for-agent
Feature: taches-flottantes-pilotage-equipe

## Parent

.scratch/taches-flottantes-pilotage-equipe/PRD.md

## What to build

Simplifier le modele pour que les taches ne soient plus rattachees aux besoins. Les rattachements de tache durables sont uniquement les candidats et les entreprises. Si un flux besoin expose encore une creation de tache, cette tache doit etre rattachee a l'entreprise du besoin, pas au besoin lui-meme.

Les anciennes taches existantes sont considerees comme des donnees de test. Aucune migration de donnees reelles n'est requise.

## Acceptance criteria

- [ ] Les nouvelles taches ne peuvent plus etre rattachees directement a un besoin.
- [ ] Les requetes et composants de taches n'utilisent plus le besoin comme rattachement durable.
- [ ] Le bloc taches des fiches besoin est retire, masque ou remplace par un comportement qui renvoie vers les taches de l'entreprise.
- [ ] Si une creation de tache reste accessible depuis un besoin, l'entreprise du besoin est preselectionnee comme rattachement.
- [ ] Les anciennes colonnes ou references besoin ne sont plus utilisees comme source de verite applicative.
- [ ] Les pages besoin continuent de fonctionner apres retrait du bloc ou du flux de tache besoin.
- [ ] Les pages candidat, entreprise et Taches continuent de fonctionner avec le modele candidat/entreprise uniquement.
- [ ] La documentation ou les commentaires proches du code ne suggerent plus que la tache est rattachee a un besoin.
- [ ] Le build passe apres suppression du rattachement besoin dans les flux applicatifs.

## Blocked by

- .scratch/taches-flottantes-pilotage-equipe/issues/01-creer-tache-multi-rattachee.md
- .scratch/taches-flottantes-pilotage-equipe/issues/03-afficher-taches-sur-fiches-candidat-entreprise.md

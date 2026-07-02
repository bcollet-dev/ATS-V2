# 02 — Simplification labels propositions + gate rattachement

Status: ready-for-agent
Feature: besoin-workflow

## What to build

Deux changements UI sur la fiche besoin et la fiche candidat, sans modification de schéma DB :

**Labels propositions** : dans `BlocPropositions` (fiche besoin) et `BlocMatchings` (fiche candidat), remplacer le label `waiting_fre` par "Retenu". Le statut `placed` ne doit plus apparaître dans le picker de statut — il reste en base mais n'est jamais exposé à l'utilisateur (seul `markMatchingWinner` peut le poser).

**Gate candidats** : sur la fiche besoin, le bouton "Proposer un candidat" n'est accessible que si le besoin est dans un statut avancé. Règle :
- `need_in_progress`, `interview`, `waiting_fre`, `client`, `rupture` → bouton actif
- `ad_chase`, `prospect` → bouton remplacé par un hint : *"Le rattachement de candidats est disponible à partir du statut Besoin en cours."*
- `lost` → rien (besoin archivé)

La prop `needStatus` doit être transmise depuis la page serveur jusqu'à `BlocPropositions`.

## Acceptance criteria

- [ ] Le badge `waiting_fre` affiche "Retenu" (fond amber conservé)
- [ ] Le picker de statut dans BlocPropositions et BlocMatchings propose exactement : CV envoyé / Entretien prévu / Retenu / Non retenu
- [ ] `placed` n'apparaît dans aucun picker de statut
- [ ] Sur un besoin en "Ad Chase", le bouton "Proposer un candidat" est absent, remplacé par le hint text
- [ ] Sur un besoin en "Prospect", même comportement
- [ ] Sur un besoin en "Perdu", ni bouton ni hint
- [ ] Sur un besoin en "Besoin en cours" (ou au-delà), le bouton est présent et fonctionnel
- [ ] Passer un besoin à "Attente FRE" manuellement alors qu'aucun candidat n'est marqué "Retenu" est bloqué par une modale
- [ ] La modale affiche la liste des candidats actifs rattachés au besoin (hors not_retained/placed/gelés) pour en sélectionner un
- [ ] Une fois un candidat sélectionné, il est marqué "Retenu" (waiting_fre) et le besoin passe en "Attente FRE"
- [ ] Si aucun candidat n'est rattaché au besoin, la modale affiche un message et un lien vers la fiche besoin
- [ ] Si des candidats sont rattachés mais tous non-actifs, la modale affiche "Aucun candidat actif" + lien vers fiche
- [ ] Passer un besoin à "Entretien" manuellement sans candidat en "Entretien prévu" est bloqué par une modale
- [ ] La modale "Entretien" affiche les candidats en "CV envoyé" avec multi-sélection (checkboxes)
- [ ] Une fois confirmée, les candidats sélectionnés passent en "Entretien prévu" et le besoin en "Entretien"
- [ ] Si aucun candidat rattaché, même comportement que pour Attente FRE (lien vers fiche)

## Blocked by

None — can start immediately.

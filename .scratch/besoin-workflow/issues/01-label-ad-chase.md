# 01 — Renommage label "Ad Chase"

Status: ready-for-agent
Feature: besoin-workflow

## What to build

Remplacer partout dans l'UI le label `"À démarcher"` par `"Ad Chase"` pour le statut `ad_chase`. Changement purement d'affichage — la valeur enum en base (`ad_chase`) est inchangée.

Surfaces concernées : colonne kanban besoins, badge vue liste besoins, badge fiche besoin, picker de statut en vue liste, menu contextuel kanban.

## Acceptance criteria

- [ ] La colonne kanban affiche "Ad Chase" (pas "À démarcher")
- [ ] Le badge statut en vue liste affiche "Ad Chase"
- [ ] La fiche besoin (`/besoins/[id]`) affiche "Ad Chase" dans le badge de statut
- [ ] Le picker de statut en vue liste affiche "Ad Chase"
- [ ] Le menu "Changer d'étape" dans le kanban affiche "Ad Chase"
- [ ] Aucune occurrence de "À démarcher" ne subsiste dans l'UI (vérifiable par grep)

## Blocked by

None — can start immediately.

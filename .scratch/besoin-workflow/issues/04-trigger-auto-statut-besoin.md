# 04 — Synchronisation automatique statut besoin depuis propositions

Status: ready-for-agent
Feature: besoin-workflow

## What to build

Chaque fois qu'un recruteur change le statut d'une proposition (candidat rattaché à un besoin), le statut du besoin se met à jour automatiquement pour refléter le candidat le plus avancé encore actif — sans action manuelle.

**Logique de calcul** (fonction privée `syncNeedStatusFromMatchings`) :

Parmi les propositions du besoin exclues de `not_retained`, `placed`, et frozen :
- Si au moins une est `waiting_fre` → besoin = `waiting_fre`
- Sinon si au moins une est `interview` → besoin = `interview`
- Sinon (toutes `cv_sent` ou aucune active) → besoin = `need_in_progress`

**Guard** : la fonction ne fait rien si le statut actuel du besoin n'est pas dans `{ need_in_progress, interview, waiting_fre }`. Les statuts `ad_chase`, `prospect`, `client`, `rupture`, `lost` sont positionnés manuellement uniquement.

**Déclencheurs** :
- `updateMatchingStatus` : appeler `syncNeedStatusFromMatchings` après le UPDATE
- `deleteMatching` : appeler `syncNeedStatusFromMatchings` après le DELETE

`createMatching` ne déclenche pas la sync (le statut initial `cv_sent` ne change rien si le besoin est déjà en `need_in_progress`).

## Acceptance criteria

- [ ] Changer un candidat de `cv_sent` à `interview` → le besoin passe automatiquement en "Entretien"
- [ ] Changer un candidat de `interview` à `waiting_fre` → le besoin passe en "Retenu" (waiting_fre)
- [ ] Marquer le dernier candidat actif en `not_retained` → le besoin régresse à "Besoin en cours"
- [ ] Si deux candidats : l'un en `waiting_fre`, l'autre en `not_retained` → besoin reste `waiting_fre`
- [ ] Si deux candidats : l'un en `interview`, l'autre en `cv_sent` → besoin = `interview`
- [ ] Supprimer le dernier candidat actif → le besoin revient à `need_in_progress`
- [ ] Un besoin en "Client" ne régresse pas automatiquement même si un candidat change de statut
- [ ] Un besoin en "Ad Chase" ou "Prospect" n'est pas affecté par les changements de propositions
- [ ] Un besoin en "Perdu" n'est pas affecté (guard)

## Blocked by

None — can start immediately.

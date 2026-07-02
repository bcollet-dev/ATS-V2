# 03 — Cascade besoin → Perdu avec confirmation candidats impactés

Status: ready-for-agent
Feature: besoin-workflow

## What to build

Quand un besoin passe en statut `lost`, deux choses doivent se produire :

**Côté data** : `updateNeedStatus(id, "lost", reason)` doit, en plus de mettre à jour le besoin, passer en `not_retained` toutes les propositions de ce besoin qui ne le sont pas déjà. Ce bulk-update ne doit PAS déclencher le recalcul automatique du statut besoin (la cascade est unilatérale).

**Côté UI** : la `LostModal` doit afficher le nombre de candidats qui seront impactés. Pour ce faire, `NeedRow` (le type retourné par `loadPipelineNeeds`) gagne un champ `activeMatchingsCount: number` calculé par une requête COUNT sur les propositions non-`not_retained` de chaque besoin. La modale affiche : *"N candidats rattachés seront marqués "Non retenu"."* (si N > 0).

## Acceptance criteria

- [ ] `NeedRow` contient `activeMatchingsCount`
- [ ] La `LostModal` affiche le nombre de candidats impactés lorsque `activeMatchingsCount > 0`
- [ ] La `LostModal` n'affiche pas de message de candidats si `activeMatchingsCount === 0`
- [ ] Après confirmation, toutes les propositions non-`not_retained` du besoin sont marquées `not_retained` en base
- [ ] Le besoin passe bien en `lost` avec le motif saisi
- [ ] Le besoin ne régresse pas en `need_in_progress` après la cascade (le trigger auto ne se déclenche pas)
- [ ] Les fiches candidats concernés reflètent le nouveau statut "Non retenu" après revalidation

## Blocked by

None — can start immediately.

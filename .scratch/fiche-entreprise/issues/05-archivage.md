Status: ready-for-agent

# 05 — Archivage d'une entreprise

## Parent

`.scratch/fiche-entreprise/PRD.md`

## What to build

Ajouter un menu discret (icône 3 points) dans le header de la fiche entreprise, visible uniquement pour les rôles non-`direction`. Ce menu contient une action "Archiver l'entreprise".

Cliquer sur "Archiver" affiche une confirmation (dialog ou alert), puis appelle l'action `archiveCompany(companyId)` qui effectue un soft-delete (`deletedAt = now()`).

Les entreprises archivées :
- Disparaissent de la liste annuaire (filtre `isNull(deletedAt)` déjà en place)
- Restent accessibles via leur URL directe `/annuaire/[id]`
- Affichent une bannière "Entreprise archivée" en haut de la fiche

## Acceptance criteria

- [ ] Menu 3 points visible dans le header pour les rôles non-`direction`
- [ ] L'option "Archiver" déclenche une confirmation avant d'agir
- [ ] Après confirmation, `deletedAt` est mis à jour en base
- [ ] L'entreprise disparaît de l'annuaire
- [ ] La fiche reste accessible via URL directe et affiche une bannière d'archivage
- [ ] Le rôle `direction` ne voit pas le menu 3 points
- [ ] Un toast confirme l'archivage

## Blocked by

None — can start immediately

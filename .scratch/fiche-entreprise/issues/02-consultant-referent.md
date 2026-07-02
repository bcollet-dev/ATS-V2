Status: ready-for-agent

# 02 — Consultant référent (sidebar)

## Parent

`.scratch/fiche-entreprise/PRD.md`

## What to build

Ajouter un bloc "Consultant référent" en haut de la sidebar de la fiche entreprise. Il affiche le `fullName` du profil assigné comme `ownerId` sur l'entreprise (ou "Non assigné" si null).

Les rôles non-`direction` peuvent modifier le référent via un `<select>` listant tous les profils actifs (non soft-deleted). La sélection déclenche immédiatement l'action `updateCompanyOwner(companyId, profileId)` qui met à jour `ownerId` en base et revalide la page.

L'utilisateur `direction` voit le bloc en lecture seule uniquement.

## Acceptance criteria

- [ ] Le bloc "Consultant référent" s'affiche en haut de la sidebar
- [ ] Le nom du référent actuel est affiché ("Non assigné" si ownerId est null)
- [ ] Les rôles non-`direction` voient un sélecteur parmi les profils actifs
- [ ] La sélection d'un profil met à jour `ownerId` en base sans rechargement de page complet
- [ ] L'utilisateur `direction` voit le bloc en lecture seule (pas de sélecteur)
- [ ] Un toast confirme la mise à jour

## Blocked by

None — can start immediately

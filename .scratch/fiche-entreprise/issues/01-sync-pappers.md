Status: ready-for-agent

# 01 — Sync Pappers depuis la fiche entreprise

## Parent

`.scratch/fiche-entreprise/PRD.md`

## What to build

Ajouter un bouton "Synchroniser depuis Pappers" dans le bloc infos générales de la fiche entreprise. Quand l'utilisateur clique, l'action lit le SIRET stocké sur l'entreprise, appelle l'API registre public (recherche.entreprises.api.gouv.fr — logique déjà présente dans `annuaire/siret-actions.ts`), puis écrit en base les champs légaux (SIREN, NAF, forme juridique, effectifs, statut administratif) ainsi que `registrySyncedAt = now()`.

Sous le bouton, afficher la date de dernière synchronisation en texte secondaire ("Dernière sync : il y a 3 jours" ou la date formatée).

Les champs issus du registre (SIRET, SIREN, NAF, forme juridique, effectifs, statut administratif) restent en lecture seule dans tous les états de la fiche — ils ne font pas partie du formulaire d'édition manuel.

Si le SIRET est absent, le bouton est désactivé avec un tooltip explicatif.

## Acceptance criteria

- [ ] Le bouton "Synchroniser" est visible dans BlocInfos (côté champs read-only) pour les rôles non-`direction`
- [ ] Cliquer déclenche l'appel API et met à jour les champs légaux + `registrySyncedAt` en base
- [ ] La date de dernière sync s'affiche sous le bouton après synchronisation (et au chargement si déjà synced)
- [ ] Si le SIRET est absent, le bouton est désactivé
- [ ] L'utilisateur `direction` ne voit pas le bouton (lecture seule uniquement)
- [ ] Un toast confirme le succès ou affiche l'erreur API
- [ ] Les champs SIRET, SIREN, NAF, legalForm, employeeRange, administrativeStatus ne sont jamais dans le formulaire d'édition manuelle

## Blocked by

None — can start immediately

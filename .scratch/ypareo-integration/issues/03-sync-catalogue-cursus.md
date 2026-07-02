# 03 — Sync catalogue sur `/cursus`

Status: done

## Parent

`.scratch/ypareo-integration/PRD.md`

## What to build

Server Action `syncYpareoCatalog()` et mise à jour de la page `/cursus` pour déclencher la sync et afficher le catalogue importé.

**Server Action `syncYpareoCatalog()` :**
- Appelle `fetchYpareoCatalog()` du client Ypareo
- Upsert des cursus sur `cursus.externalId` (met à jour `name`, `code`, `rawData`, `syncedAt`)
- Upsert des classes sur `classes.externalId` (met à jour `cursusId`, `site`, `startDate`, `endDate`, `rawData`, `syncedAt`)
- Retourne `{ cursusCount, classesCount, syncedAt }`

**Page `/cursus` :**
- Bouton "Synchroniser" avec état de chargement pendant la sync
- Affiche la date de dernière synchronisation
- Liste des cursus importés avec, pour chaque cursus, la liste de ses actions de formation (classes) en accordéon ou table imbriquée

## Acceptance criteria

- [ ] `syncYpareoCatalog()` upserte correctement cursus et classes sans dupliquer les enregistrements
- [ ] Le bouton "Synchroniser" sur `/cursus` est désactivé pendant l'appel et affiche un spinner
- [ ] La date de dernière sync est visible après synchronisation
- [ ] La liste cursus/classes est visible sur `/cursus` après sync
- [ ] Accès restreint aux rôles autorisés (admin, admissions, relations_entreprises — cohérent avec le reste de l'app)

## Blocked by

- `02-ypareo-client-lib.md`

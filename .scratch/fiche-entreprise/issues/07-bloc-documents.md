Status: ready-for-agent

# 07 — BlocDocuments sur la fiche entreprise

## Parent

`.scratch/fiche-entreprise/PRD.md`

## What to build

Ajouter un bloc "Documents" dans la sidebar de la fiche entreprise, sous le bloc FRE. Même pattern que le bloc documents de la fiche candidat : liste des documents avec `companyId = id`, upload d'un nouveau fichier rattaché à l'entreprise, téléchargement, suppression.

Exemples de documents typiques : KBIS, contrats signés, FRE générés.

Le rôle `direction` voit les documents en lecture seule (pas d'upload ni suppression).

## Acceptance criteria

- [ ] Le bloc "Documents" s'affiche en sidebar sous le bloc FRE
- [ ] Les documents affichés sont ceux avec `companyId` correspondant à l'entreprise courante
- [ ] Les rôles non-`direction` peuvent uploader un fichier rattaché à l'entreprise
- [ ] Les rôles non-`direction` peuvent supprimer un document
- [ ] Chaque document est téléchargeable
- [ ] Le rôle `direction` voit la liste en lecture seule
- [ ] "Aucun document" si la liste est vide

## Blocked by

None — can start immediately

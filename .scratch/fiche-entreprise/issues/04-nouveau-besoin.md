Status: ready-for-agent

# 04 — Nouveau besoin depuis la fiche entreprise

## Parent

`.scratch/fiche-entreprise/PRD.md`

## What to build

Ajouter un bouton "Nouveau besoin" dans l'en-tête de la section "Besoins liés" de la fiche entreprise. Cliquer ouvre le drawer de création de besoin existant avec le champ entreprise pré-rempli et verrouillé sur l'entreprise courante.

Si le drawer de création de besoin n'accepte pas encore une prop `companyId` (pré-remplissage + verrouillage du sélecteur entreprise), l'adapter en amont.

Le bouton est masqué pour le rôle `direction`.

## Acceptance criteria

- [ ] Un bouton "Nouveau besoin" apparaît dans l'en-tête de la section besoins liés
- [ ] Cliquer ouvre le drawer de création avec l'entreprise pré-remplie et non modifiable
- [ ] Après création, le nouveau besoin apparaît dans la liste sans rechargement manuel
- [ ] Le bouton est masqué pour le rôle `direction`

## Blocked by

None — can start immediately

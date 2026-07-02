Status: ready-for-agent

# 03 — Section Personnel : Alternants placés

## Parent

`.scratch/fiche-entreprise/PRD.md`

## What to build

Renommer le bloc "Contacts" en "Personnel" et y ajouter une sous-section "Alternants" en dessous de la sous-section "Contacts" existante.

La sous-section "Alternants" liste les candidats placés chez cette entreprise : ce sont les matchings avec `isWinner = true` dont le besoin associé a `companyId = id` et `status IN ('client', 'rupture')` et n'est pas soft-deleted.

Pour chaque alternant, afficher :
- Prénom + Nom (lien cliquable vers `/candidats/[id]`)
- Intitulé du besoin (`need.title`)
- Date de fin de contrat (`need.endDate`) si présente
- Badge de statut :
  - `need.status = 'rupture'` → badge rouge "Rupture"
  - `need.status = 'client'` et `need.endDate` dépassée → badge noir "Terminé"
  - `need.status = 'client'` et `need.endDate` non dépassée ou nulle → badge vert "En cours"

La sous-section "Alternants" est en lecture seule pour tous les rôles (pas de CRUD — les alternants sont gérés via les besoins et matchings).

La sous-section "Contacts" conserve son CRUD existant inchangé.

## Acceptance criteria

- [ ] Le bloc s'appelle "Personnel" (pas "Contacts")
- [ ] La sous-section "Contacts" est fonctionnellement identique à l'ancienne BlocContacts
- [ ] La sous-section "Alternants" s'affiche sous "Contacts"
- [ ] Les alternants listés sont ceux avec `matching.isWinner = true` sur les besoins `client`/`rupture` de l'entreprise
- [ ] Badge vert "En cours" : `client` et endDate non dépassée (ou null)
- [ ] Badge noir "Terminé" : `client` et endDate < aujourd'hui
- [ ] Badge rouge "Rupture" : `rupture`
- [ ] Cliquer sur un alternant navigue vers `/candidats/[id]`
- [ ] "Aucun alternant placé" si la liste est vide
- [ ] La sous-section Alternants est en lecture seule pour tous les rôles

## Blocked by

None — can start immediately

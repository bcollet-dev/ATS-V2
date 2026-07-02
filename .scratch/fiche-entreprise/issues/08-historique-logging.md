Status: ready-for-agent

# 08 — BlocHistorique + Logging des événements entreprise

## Parent

`.scratch/fiche-entreprise/PRD.md`

## What to build

Deux choses liées :

**1. Composant BlocHistorique**
Ajouter un bloc "Historique" en bas de la colonne principale, même pattern que le bloc historique de la fiche candidat : Server Component, requête sur `activityEvents` filtrée par `companyId`, affichage des 15 derniers événements en timeline, lien "Tout voir" vers `/historique?entreprise=[id]`.

La table `activityEvents` a déjà un champ `companyId` et un index associé — aucune migration nécessaire.

**2. Logging dans les Server Actions**
Ajouter un insert dans `activityEvents` à la fin de chaque action qui modifie l'entreprise :

| Action | actionType | Résumé |
|---|---|---|
| updateCompanyInfo | `company.updated` | "Informations mises à jour par X" |
| updateCompanyFRE | `company.fre_updated` | "Données FRE mises à jour par X" |
| updateCompanyOwner (issue 02) | `company.owner_updated` | "Consultant référent changé par X" |
| syncFromPappers (issue 01) | `company.registry_synced` | "Synchronisation Pappers par X" |
| addContact | `company.contact_added` | "Contact Prénom Nom ajouté par X" |
| updateContact | `company.contact_updated` | "Contact Prénom Nom modifié par X" |
| deleteContact | `company.contact_deleted` | "Contact Prénom Nom supprimé par X" |
| archiveCompany (issue 05) | `company.archived` | "Entreprise archivée par X" |

Les événements de tâches (`task.created`, etc.) sont déjà loggués avec `companyId` dans les actions tâches existantes.

## Acceptance criteria

- [ ] Le bloc "Historique" s'affiche en bas de la colonne principale de la fiche entreprise
- [ ] Il affiche les 15 derniers événements liés à l'entreprise en ordre chronologique inverse
- [ ] Chaque événement affiche : résumé, auteur, date relative
- [ ] Le lien "Tout voir" navigue vers la page historique filtrée sur l'entreprise
- [ ] Chacune des 8 actions ci-dessus insère bien un événement dans `activityEvents` avec le bon `companyId` et `actionType`
- [ ] Les événements de tâches créées via le BlocTaches (issue 06) apparaissent dans l'historique

## Blocked by

None — can start immediately (le composant peut être livré même si peu d'événements sont encore loggués)

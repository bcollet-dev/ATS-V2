# PRD — Fiche Entreprise `/annuaire/[id]`

Status: ready-for-agent

---

## Problem Statement

Les consultants EDA Groupe n'ont pas de vue centralisée sur une entreprise partenaire : les contacts RH, les alternants placés, les besoins en cours, les documents contractuels (FRE, KBIS) et l'historique des interactions sont éparpillés ou absents de l'ATS. Ouvrir une fiche entreprise ne renvoie aujourd'hui qu'un squelette partiel : infos générales + contacts éditables + besoins liés en lecture seule.

---

## Solution

Une fiche entreprise complète, organisée en deux colonnes, qui centralise toutes les informations opérationnelles d'un compte client : informations légales (avec synchronisation Pappers), personnel (contacts interlocuteurs + alternants placés), besoins, tâches, documents et historique d'activité. La sidebar regroupe les métadonnées de gestion : consultant référent, données FRE/contrat et documents.

---

## User Stories

1. En tant que consultant, je veux voir d'un coup d'œil le nom, la ville, le SIRET, le code NAF et le statut administratif (actif / fermé) d'une entreprise dans le header de la fiche, pour valider qu'il s'agit bien du bon compte.
2. En tant que consultant, je veux modifier les informations éditables d'une entreprise (raison sociale, adresse, code postal, ville, secteur, site web, notes) depuis la fiche, pour maintenir les données à jour.
3. En tant que consultant, je veux que SIRET, SIREN, NAF, forme juridique et effectifs soient en lecture seule sur la fiche, car ils proviennent du registre public et ne doivent pas être modifiés manuellement.
4. En tant que consultant, je veux cliquer sur un bouton "Synchroniser depuis Pappers" dans le bloc infos, pour remplir automatiquement les champs issus du registre (SIRET, SIREN, NAF, forme juridique, effectifs, statut administratif).
5. En tant que consultant, je veux voir la date de la dernière synchronisation Pappers, pour savoir si les données légales sont récentes.
6. En tant que consultant, je veux voir et modifier les données FRE/contrat (IDCC, convention collective, OPCO, caisse de retraite, prévoyance, représentant légal) dans la sidebar, pour préparer la génération de CERFA.
7. En tant que consultant, je veux être alerté visuellement dans le bloc FRE si des champs obligatoires au CERFA sont manquants, pour les compléter avant de lancer la génération.
8. En tant que consultant, je veux voir le consultant référent assigné à l'entreprise dans la sidebar, pour savoir qui pilote ce compte.
9. En tant que consultant non-direction, je veux changer le consultant référent depuis la fiche via un sélecteur parmi les profils actifs, pour remettre à jour la responsabilité d'un compte.
10. En tant que consultant, je veux voir dans la section "Personnel" la liste des contacts interlocuteurs de l'entreprise (RH, direction, maîtres d'apprentissage), pour savoir à qui m'adresser.
11. En tant que consultant non-direction, je veux ajouter, modifier et supprimer des contacts depuis la section "Personnel", pour tenir à jour le carnet d'adresses de l'entreprise.
12. En tant que consultant, je veux marquer un contact comme "contact principal" dans la section "Personnel", pour identifier l'interlocuteur privilégié lors d'envois de CV.
13. En tant que consultant, je veux voir dans la section "Personnel" les alternants placés chez cette entreprise, pour avoir une vue complète du personnel en lien avec EDA.
14. En tant que consultant, je veux voir un badge "En cours" (vert) pour un alternant dont le contrat est actif (`need.status = client` et date de fin non dépassée), pour distinguer les contrats en cours.
15. En tant que consultant, je veux voir un badge "Terminé" (noir) pour un alternant dont la date de fin de contrat est dépassée (`need.status = client` et `need.endDate < aujourd'hui`), pour distinguer les contrats arrivés à terme.
16. En tant que consultant, je veux voir un badge "Rupture" (rouge) pour un alternant dont le contrat a été rompu (`need.status = rupture`), pour identifier les ruptures de contrat.
17. En tant que consultant, je veux cliquer sur un alternant placé dans la section "Personnel" pour accéder à sa fiche candidat, pour retrouver rapidement son dossier complet.
18. En tant que consultant, je veux voir les besoins liés à l'entreprise avec leur statut, leur ville et un lien vers la fiche besoin, pour avoir une vue pipeline rapide.
19. En tant que consultant non-direction, je veux créer un nouveau besoin directement depuis la fiche entreprise via un bouton dédié, pour ne pas avoir à ressaisir l'entreprise dans le formulaire de création.
20. En tant que consultant, je veux voir les tâches liées à l'entreprise, pour ne pas manquer de relances ou d'actions en cours.
21. En tant que consultant non-direction, je veux créer une tâche liée à l'entreprise depuis la fiche, pour centraliser le suivi sans quitter la fiche.
22. En tant que consultant, je veux voir les documents liés à l'entreprise (KBIS, contrats signés, FRE générés) dans la sidebar, pour accéder rapidement aux pièces jointes sans passer par un outil externe.
23. En tant que consultant non-direction, je veux uploader un document et le rattacher à l'entreprise depuis la fiche, pour centraliser les pièces contractuelles.
24. En tant que consultant, je veux voir un historique chronologique des actions sur l'entreprise (création, modifications, contacts ajoutés/modifiés/supprimés, FRE mis à jour, emails envoyés, tâches créées, archivage), pour comprendre l'historique du compte.
25. En tant que consultant non-direction, je veux archiver une entreprise depuis un menu discret (3 points) dans le header de la fiche, pour retirer du pipeline un compte qui n'est plus actif sans perdre les données.
26. En tant que consultant, je veux voir une bannière "Entreprise archivée" sur la fiche d'une entreprise archivée, pour savoir immédiatement que le compte n'est plus actif.
27. En tant qu'utilisateur direction, je veux voir toutes les informations de la fiche entreprise, mais sans pouvoir modifier, archiver, ajouter ni supprimer quoi que ce soit.

---

## Implementation Decisions

### Layout général

Deux colonnes sticky-top :
- **Colonne principale (flex-1)** : BlocInfos → BlocPersonnel → BlocBesoins → BlocTaches → BlocHistorique
- **Sidebar (w-72 fixe)** : BlocConsultantReferent → BlocFRE → BlocDocuments

### Sécurité

`canEdit = actor.role !== "direction"` transmis à tous les blocs clients comme prop. Les Server Actions vérifient elles-mêmes `actor.role === "direction"` et retournent `{ success: false, error: "Non autorisé" }`.

### BlocInfos — Sync Pappers

- La logique de sync Pappers existe déjà dans `annuaire/siret-actions.ts`. L'action `syncFromPappers(companyId)` réutilise ce code, lit le SIRET stocké, appelle l'API, écrit les champs registre + `registrySyncedAt`.
- Les champs issus du registre (SIRET, SIREN, NAF, legalForm, employeeRange, administrativeStatus) restent en lecture seule dans tous les états — ils ne sont jamais dans le formulaire d'édition.
- La date de dernière sync s'affiche sous le bouton en texte secondaire.

### BlocPersonnel (renommé depuis BlocContacts)

Deux sous-sections dans le même bloc :

**"Contacts"** — CRUD existant, inchangé fonctionnellement.

**"Alternants"** — requête :
```
matchings (isWinner = true)
  → needs (companyId = id, status IN ('client','rupture'), not deleted)
  → candidates (not deleted)
```
Logique de badge :
- `need.status = 'rupture'` → badge rouge "Rupture"
- `need.status = 'client'` et `need.endDate` dépassée → badge noir "Terminé"
- `need.status = 'client'` et `need.endDate` non dépassée (ou null) → badge vert "En cours"

Chaque alternant est un lien cliquable vers `/candidats/[id]`. On affiche : prénom + nom, badge statut, intitulé du besoin (need.title), date de fin si présente.

### BlocConsultantReferent

Nouveau petit bloc sidebar. Affiche le `fullName` du consultant référent (`ownerId`). En mode édition : `<select>` parmi les profils actifs (non-deletedAt). Action `updateCompanyOwner(companyId, ownerId)`.

### BlocBesoins

Ajout d'un bouton "Nouveau besoin" dans l'en-tête de la section. Ouvre le drawer de création de besoin existant (`BesoinDrawer`) avec `companyId` pré-rempli. Si le drawer n'accepte pas encore `companyId` en prop, l'adapter.

### BlocTaches

Même pattern que `BlocTaches` sur la fiche candidat. Filter `tasks.companyId = id`. Création inline avec `companyId` pré-rempli.

### BlocDocuments

Même pattern que `BlocDocuments` sur la fiche candidat. Filter `documents.companyId = id`. Upload et liste de fichiers.

### BlocHistorique

Même pattern que `BlocHistorique` sur la fiche candidat (Server Component, `activityEvents` filtrés par `companyId`, limite 15, lien "Tout voir" vers `/historique?entreprise=id`).

Événements à logger dans chaque Server Action :

| Action | actionType |
|---|---|
| Création entreprise | `company.created` |
| Mise à jour infos générales | `company.updated` |
| Sync Pappers | `company.registry_synced` |
| Mise à jour FRE | `company.fre_updated` |
| Mise à jour consultant référent | `company.owner_updated` |
| Contact ajouté | `company.contact_added` |
| Contact modifié | `company.contact_updated` |
| Contact supprimé | `company.contact_deleted` |
| Email envoyé (depuis matching) | `company.email_sent` |
| Tâche créée | `task.created` (déjà existant, companyId déjà logué) |
| Archivage | `company.archived` |

### Archivage

Action `archiveCompany(companyId)` : set `deletedAt = now()`, log `company.archived`. La fiche reste accessible via lien direct mais affiche une bannière. L'annuaire filtre `isNull(companies.deletedAt)` (déjà en place).

---

## Testing Decisions

Les tests doivent tester le comportement externe visible par l'utilisateur, pas les détails d'implémentation des blocs internes.

**Seams à tester :**
- Les Server Actions (`loadCompany`, `updateCompanyInfo`, `updateCompanyFRE`, `addContact`, `updateContact`, `deleteContact`, `updateCompanyOwner`, `archiveCompany`, `syncFromPappers`) — tester qu'elles respectent les règles d'accès (`direction` bloqué) et retournent les bonnes données.
- La logique de badge alternants (rupture / terminé / en cours) — tester la fonction de classification avec des fixtures de `need.status` et `need.endDate`.

**Prior art :** les actions de la fiche candidat (`candidats/[id]/actions.ts`) sont testées de la même façon.

---

## Out of Scope

- Génération automatique du CERFA/FRE depuis la fiche (le bloc FRE prépare les données, mais le bouton "Générer" est une feature séparée).
- Envoi d'email directement depuis la fiche entreprise (les emails passent par la page Matching).
- Historique paginé / filtrable (la section affiche les 15 derniers événements ; le lien "Tout voir" renvoie vers la page `/historique`).
- Fusion de fiches entreprises en doublon.
- Import en masse d'entreprises.

---

## Further Notes

- L'infrastructure `activityEvents.companyId` et l'index associé existent déjà en base — pas de migration nécessaire pour l'historique.
- La sync Pappers utilise l'API publique française (recherche.entreprises.api.gouv.fr) via la logique déjà présente dans `annuaire/siret-actions.ts`.
- `isPrimary` sur `companyContacts` est une colonne `text` (pas boolean) : `"true"` = principal, `null` = non principal. Conserver ce pattern dans tous les nouveaux blocs.
- `canEdit = actor.role !== "direction"` s'applique à toutes les actions de modification — aucune exception.

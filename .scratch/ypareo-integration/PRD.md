# PRD — Intégration Ypareo bidirectionnelle

Status: ready-for-agent

## Problem Statement

L'ATS V2 gère des candidats en alternance mais n'est pas encore connecté à Ypareo (le SIRH de l'organisme de formation). Les conseillers doivent ressaisir manuellement les informations de placement dans Ypareo après les avoir traitées dans l'ATS, ce qui génère des doublons de saisie, des erreurs, et une perte de temps. Côté catalogue, les cursus et actions de formation doivent être importés depuis Ypareo pour être rattachés aux candidats — aujourd'hui c'est une saisie manuelle.

## Solution

Deux flux bidirectionnels :

1. **Réception (sync catalogue)** — Un bouton "Synchroniser" sur `/cursus` importe depuis l'API Ypareo la liste des produits formation (cursus) et leurs actions de formation (classes), stockés dans les tables `cursus` et `classes`. Déclenchement manuel uniquement.

2. **Envoi (push placement)** — Lorsqu'un besoin passe au statut "Client" ou qu'un candidat passe au statut "Placé", une modale de confirmation s'ouvre, récapitule toutes les données qui vont être poussées, avertit des champs manquants (non-bloquant), demande le choix de l'action de formation (classe), puis envoie un payload monolithique à l'endpoint Ypareo via un unique POST.

## User Stories

1. En tant que conseiller, je veux synchroniser le catalogue Ypareo depuis `/cursus` d'un clic, pour avoir les bons cursus et actions de formation disponibles dans l'ATS.
2. En tant que conseiller, je veux voir la liste des cursus importés et leurs actions de formation sur `/cursus`, pour vérifier que la sync a bien fonctionné.
3. En tant que conseiller, je veux que lorsque je passe un besoin au statut "Client", une modale s'ouvre automatiquement pour confirmer l'envoi sur Ypareo.
4. En tant que conseiller, je veux que lorsque je passe un candidat au statut "Placé", une modale s'ouvre automatiquement pour confirmer l'envoi sur Ypareo.
5. En tant que conseiller, je veux choisir l'action de formation (classe) rattachée au cursus du candidat dans la modale de placement, pour que Ypareo enregistre le bon contrat.
6. En tant que conseiller, je veux voir dans la modale tous les champs qui vont être envoyés à Ypareo (candidat, entreprise, maître d'apprentissage, contrat), pour vérifier leur exactitude avant envoi.
7. En tant que conseiller, je veux être averti clairement des champs manquants avant d'envoyer, mais pouvoir envoyer quand même après confirmation, car l'envoi n'est pas bloquant.
8. En tant que conseiller, je veux voir sur la fiche candidat si et quand il a été envoyé sur Ypareo, pour ne pas envoyer en double.
9. En tant qu'admin, je veux consulter le log détaillé de chaque appel Ypareo (payload, réponse, statut) dans `/erreurs`, pour diagnostiquer les problèmes d'intégration.
10. En tant que système, je veux que le NIR du candidat ne soit jamais stocké en clair dans les logs Ypareo, pour respecter les contraintes de sécurité.
11. En tant que conseiller, je veux pouvoir saisir le téléphone et l'email de l'entreprise sur la fiche entreprise, pour qu'ils soient disponibles lors du push Ypareo.
12. En tant que conseiller, je veux pouvoir saisir le nom de naissance du maître d'apprentissage sur la fiche besoin, pour satisfaire les exigences du CERFA.

## Implementation Decisions

### Auth Ypareo
- `POST /authenticate` avec `YPAREO_IDENTIFICATION_TOKEN` → bearer token mis en cache mémoire 45 min (pattern V1 identique, à porter en `src/lib/ypareo/client.ts`)

### Sync catalogue (`/cursus`)
- Endpoints : `/formation` (cursus/produits) + `/parcours-action-formation` (classes/actions)
- Pagination : 500 items/page (`Skip` / `Top` query params)
- Upsert sur `cursus.externalId` et `classes.externalId` — les enregistrements existants sont mis à jour, les disparus sont conservés (soft delete non requis pour l'instant)
- Server Action `syncYpareoCatalog()` appelée depuis le bouton côté client avec état de chargement

### Push placement
- Un seul `POST YPAREO_PLACEMENT_PATH` avec payload monolithique (candidat + entreprise + maître d'apprentissage + contrat + cursus + action de formation)
- Deux points de déclenchement :
  1. **BlocStatutBesoin** : au passage vers `client` → modale Ypareo s'ouvre avant de confirmer le changement de statut
  2. **BlocStatutCandidat** : au passage vers `placed` → modale Ypareo s'ouvre avant de confirmer
- La modale récapitule les données en sections (Candidat / Entreprise / Maître d'apprentissage / Contrat), affiche les warnings pour champs manquants, permet le choix de la classe, puis appelle `pushYpareoPlacement()`

### Choix de la classe dans la modale
- Picker cursus → picker classe filtré par cursus (même pattern que V1)
- Le cursus est pré-sélectionné si `candidate.cursusId` est renseigné

### Champs manquants — logique de warning
Champs vérifiés côté client avant affichage de la modale, regroupés par section :
- **Candidat** : `title`, `firstName`, `lastName`, `birthName`, `birthDate`, `birthCity`, `birthCountry`, `nationality`, `rqth`, `nirEncrypted`, `email`, `addressLine1`, `postalCode`, `city`
- **Entreprise** : `name`, `address`, `postalCode`, `city`, `phone`, `email`, `siret`, `nafCode`, `employeeRange`, `idcc`, `retirementFund`
- **Maître d'apprentissage** : `masterFirstName`, `masterLastName`, `masterBirthName`, `masterEmail`, `masterPhone`
- **Contrat** : `weeklyHours`, `startDate`, `endDate`, `salaryReference`, `smcAmount`

Si des champs manquent → bandeau d'avertissement + checkbox "Je confirme envoyer malgré les données incomplètes" avant de pouvoir valider.

### Logging
- Table `ypareoLogs` existante — un log par appel avec `status: "pending"` → `"success"` | `"error"`
- `requestPayload` stocké avec NIR masqué (`nirEncrypted` remplacé par `"[MASKED]"`)
- `candidateId` + `companyId` + `correlationId` renseignés pour traçabilité
- Visible dans `/erreurs` (admin uniquement, `direction` exclue)

### Indicateur sur fiche candidat
- Si `candidate.ypareoPersonId` est renseigné OU si un `ypareoLog` avec `status: "success"` existe pour ce candidat → badge "Envoyé sur Ypareo" avec date

### Migrations DB requises
```
ALTER TABLE companies ADD COLUMN phone text;
ALTER TABLE companies ADD COLUMN email text;
ALTER TABLE needs ADD COLUMN master_birth_name text;
```

### Formulaires à mettre à jour
- Fiche entreprise (création + édition) : ajouter champs `phone` et `email`
- Fiche besoin — section maître d'apprentissage : ajouter champ `masterBirthName`

### Sécurité
- NIR jamais exposé dans les logs (masqué avant stockage)
- `ypareoLogs` accessible admin uniquement — `direction` exclue (cohérent avec `adminNavItems`)
- `YPAREO_IDENTIFICATION_TOKEN` uniquement côté serveur, jamais dans le client

## Testing Decisions

- Les Server Actions Ypareo (`syncYpareoCatalog`, `pushYpareoPlacement`) sont testables en isolation avec un mock de `fetchYpareoCatalog` et `pushPlacementToYpareo`
- La logique de détection des champs manquants (côté client) mérite un test unitaire : chaque section, chaque champ absent → bon warning affiché
- Le masquage du NIR dans le payload de log est un invariant de sécurité critique à tester en unitaire
- Prior art de tests dans le projet : pas de test e2e existant — les tests unitaires sont la seule surface disponible

## Out of Scope

- Cron automatique pour la sync catalogue (manuel seulement pour l'instant)
- Retry automatique en cas d'échec du push Ypareo
- Contact signataire séparé (FRE) — à ajouter uniquement si Ypareo l'exige explicitement à l'usage
- Réception de données Ypareo vers ATS (sens inverse du placement)
- Suppression / mise à jour des placements existants dans Ypareo

## Further Notes

- V1 reference : `C:\ATS_V1\apps\ats\src\lib\ypareo\client.ts` et `ypareo-placement-modal.tsx` — porter en V2 en adaptant à Drizzle + App Router
- Le bearer token Ypareo a une durée de vie de 45 min — le cache mémoire du V1 est correct, à reproduire à l'identique
- `YPAREO_BASE_URL` et `YPAREO_IDENTIFICATION_TOKEN` sont déjà dans `.env`

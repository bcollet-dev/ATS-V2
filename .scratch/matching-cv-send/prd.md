# PRD — Page Matching : envoi de CVs et statuts automatiques

## Problem Statement

Les recruteurs manquent d'un workflow fluide entre la création d'un matching et l'envoi des CVs à l'entreprise. Aujourd'hui il n'existe pas de statut besoin dédié au "prêt à envoyer", pas de déclenchement automatique, et il est impossible de supprimer un matching directement depuis la page matching. La modale d'envoi ne permet pas non plus de décocher des candidats individuellement.

## Solution

Ajouter deux statuts besoin (`a_shooter`, `cv_envoye`) mis à jour automatiquement, exposer la suppression de matching dans la page matching, et permettre la décochabilité individuelle des candidats dans la modale d'envoi. La page existante `/matching` (double colonne candidats/besoins + banner flottant) est la base — on étend sans restructurer.

## User Stories

1. Comme recruteur, je veux que le besoin passe automatiquement en "À shooter" dès qu'un premier matching est créé, afin de voir immédiatement quels besoins ont des candidats prêts à envoyer.
2. Comme recruteur, je veux que le besoin passe en "CV envoyé" après un envoi réussi par email, pour tracker le statut sans action manuelle.
3. Comme recruteur, je veux voir les candidats déjà matchés sur un besoin directement depuis la carte besoin, sans quitter la page matching.
4. Comme recruteur, je veux supprimer un matching depuis la page matching, sans avoir à aller dans la fiche besoin.
5. Comme recruteur, je veux sélectionner uniquement des besoins (sans cocher de candidats) et accéder au bouton "Envoyer les CV" pour les matchings existants de ces besoins.
6. Comme recruteur, je veux décocher individuellement un candidat dans la modale d'envoi avant d'envoyer, sans modifier la sélection globale.
7. Comme recruteur, je veux uploader un CV manquant directement dans la modale si un candidat n'en a pas, et que ça se synchronise sur sa fiche.
8. Comme recruteur, je veux voir les statuts "À shooter" et "CV envoyé" dans les badges des cartes besoin et le filtre statut.

## Implementation Decisions

### Nouveaux statuts enum

Ajouter `a_shooter` et `cv_envoye` à l'enum PostgreSQL `need_status` via migration `ALTER TYPE`. Ordre logique dans le pipeline : `need_in_progress → a_shooter → cv_envoye → interview → waiting_fre → client`.

### Déclenchement automatique `a_shooter`

Dans `batchCreateMatchings` (et `createMatching`), après l'insert, pour chaque needId affecté : si le statut actuel du besoin est dans `{need_in_progress, ad_chase, prospect}`, le passer à `a_shooter`. Ne pas downgrader les statuts plus avancés (`cv_envoye`, `interview`, `waiting_fre`, `client`).

La fonction `syncNeedStatusFromMatchings` existante gère `need_in_progress/interview/waiting_fre` en fonction des matchings actifs — elle reste inchangée. La logique `a_shooter` est un bump one-way à la création uniquement.

### Déclenchement automatique `cv_envoye`

Dans `sendMatchingEmails`, après les envois réussis, pour chaque `needId` avec au moins un envoi réussi : si le statut actuel est `a_shooter`, le passer à `cv_envoye`. Ne pas modifier les statuts plus avancés.

### Suppression de matching depuis la page matching

La `NeedCard` devient expansible : clic sur une zone dédiée (ex. le compteur "X candidats en cours") déploie une liste des matchings actifs avec nom du candidat + statut proposition + bouton delete. L'action appelle `deleteMatching` existant en server action. Mise à jour optimiste côté client.

Le `MatchingNeedRow` est enrichi de `activeMatchings: { matchingId, candidateId, candidateFirstName, candidateLastName, propositionStatus }[]` à la place du simple tableau d'IDs.

### Banner visible sur sélection besoins seuls

`showBanner` passe de `selectedCandIds.size >= 1 && selectedNeedIds.size >= 1` à `selectedNeedIds.size >= 1`. Quand uniquement des besoins sont sélectionnés, le banner affiche uniquement "Envoyer les CV" (pas "Créer les matchings"). Le bouton "Créer les matchings" n'apparaît que quand les deux côtés sont sélectionnés.

La `SendEmailModal` reçoit en props les `selectedCandidates` **ou**, si vide, charge automatiquement les candidats matchés aux besoins sélectionnés via `loadEmailModalData`.

### Décochage individuel dans la modale

Dans la section "Pièces jointes" de `SendEmailModal`, chaque ligne candidat ajoute une checkbox (cochée par défaut). Une case décochée exclut ce candidat des `cvDocumentIds` à envoyer. Le candidat reste visible (barré / grisé) mais son CV n'est pas joint.

### Labels et badges

Ajouter `a_shooter` et `cv_envoye` dans `NEED_STATUS_LABEL` et `NEED_STATUS_BADGE` partout où les statuts besoins sont affichés (page matching, page besoins, fiche besoin). Couleurs : `a_shooter` → orange/amber, `cv_envoye` → sky/bleu clair.

### Schema DB

```sql
ALTER TYPE need_status ADD VALUE IF NOT EXISTS 'a_shooter' AFTER 'need_in_progress';
ALTER TYPE need_status ADD VALUE IF NOT EXISTS 'cv_envoye' AFTER 'a_shooter';
```

## Testing Decisions

- Tests manuels : créer un matching → vérifier statut besoin `a_shooter` ; envoyer via la modale → vérifier `cv_envoye`
- Vérifier que les statuts plus avancés (`interview`, `client`) ne sont pas downgradés
- Vérifier que décocher un candidat dans la modale exclut bien son CV de l'envoi
- Vérifier que la suppression depuis la page matching met à jour le compteur sans reload

## Out of Scope

- Modification du destinataire pour ajouter/supprimer plusieurs contacts : déjà géré dans la modale existante via le select par besoin
- Envoi de CVs par autre canal que Gmail OAuth
- Historique des emails envoyés (déjà loggé via `activityEvents`)
- Page dédiée "trames-mail" : les templates sont déjà chargés depuis `mailTemplates`

## Further Notes

- `deleteMatching` est déjà implémenté côté serveur — aucun nouveau server action à créer pour la suppression
- L'upload CV inline dans la modale (`uploadCandidateCV`) est déjà implémenté et synchronise avec la fiche candidat
- `sendMatchingEmails` utilise Gmail OAuth via `user.googleRefreshToken` — la configuration env est déjà en place mais les credentials Google sont vides en `.env.local`

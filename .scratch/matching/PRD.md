# PRD — Chantier Matching
**Version** : 1.0 · **Date** : 2026-06-29 · **Statut** : ready-for-agent

---

## Problem Statement

Le recruteur doit aujourd'hui naviguer individuellement dans chaque fiche candidat ou fiche besoin pour créer un matching. Il n'existe aucune vue transversale qui lui permette de voir simultanément l'ensemble des candidats disponibles et des besoins ouverts, de comparer leur compatibilité, et de créer des associations en lot. De même, l'envoi des CV aux entreprises est manuel et hors-ATS : il faut sortir de l'outil, retrouver les CV, et composer un email à la main. Ces deux frictions ralentissent les recruteurs au moment le plus critique du pipeline.

---

## Solution

Une page dédiée `/matching` expose deux colonnes côte à côte — candidats à gauche, besoins à droite. Le recruteur sélectionne librement N candidats et M besoins via des cases à cocher ; un bandeau flottant persistant affiche le décompte de sélection et propose deux actions : créer les matchings en lot, puis envoyer les CV par email directement à l'entreprise via Gmail OAuth2. Les paires déjà rattachées sont visuellement distinguées et silencieusement ignorées à la création. Chaque colonne dispose de filtres, d'une recherche et d'un tri indépendants. La page est le cockpit unique du recruteur pour tout le travail de proposition.

---

## User Stories

### Vue principale

1. Comme recruteur, je veux accéder à `/matching` depuis la navigation principale, afin d'avoir un point d'entrée dédié au travail de proposition.
2. Comme recruteur, je veux voir la liste complète des candidats dans la colonne gauche, afin d'identifier rapidement ceux à proposer.
3. Comme recruteur, je veux voir la liste complète des besoins actifs dans la colonne droite, afin de choisir les destinations pertinentes.
4. Comme recruteur, je veux que les deux colonnes soient indépendantes en termes de filtre, recherche et tri, afin de pouvoir affiner chaque côté sans impacter l'autre.

### Filtres, recherche et tri — Candidats

5. Comme recruteur, je veux filtrer les candidats par cursus envisagé, afin de cibler uniquement les profils pertinents pour un besoin.
6. Comme recruteur, je veux filtrer les candidats par statut pipeline (ex. admissible, entretien entreprise), afin de n'afficher que les candidats prêts à être proposés.
7. Comme recruteur, je veux filtrer les candidats par recruteur référent, afin de traiter uniquement mon portefeuille.
8. Comme recruteur, je veux filtrer les candidats par ville de résidence, afin de faire correspondre les contraintes géographiques avec le lieu du besoin.
9. Comme recruteur, je veux rechercher un candidat par nom ou prénom, afin de le retrouver rapidement sans parcourir la liste.
10. Comme recruteur, je veux trier les candidats par nom, date de mise à jour ou statut, afin de prioriser mon travail.
11. Comme recruteur, je veux voir si un candidat possède déjà un CV enregistré dans sa fiche, afin de savoir si je pourrai envoyer son CV par email depuis cette page.

### Filtres, recherche et tri — Besoins

12. Comme recruteur, je veux filtrer les besoins par cursus cible, afin de ne voir que les postes compatibles avec les candidats sélectionnés.
13. Comme recruteur, je veux filtrer les besoins par statut pipeline (ex. besoin en cours, entretien), afin d'exclure les besoins non actifs.
14. Comme recruteur, je veux filtrer les besoins par entreprise, afin de travailler par compte client.
15. Comme recruteur, je veux filtrer les besoins par ville, afin de cibler les opportunités géographiquement compatibles.
16. Comme recruteur, je veux filtrer les besoins par recruteur référent, afin de me concentrer sur mon portefeuille.
17. Comme recruteur, je veux rechercher un besoin par titre ou nom d'entreprise, afin de le retrouver rapidement.
18. Comme recruteur, je veux trier les besoins par titre, date de mise à jour, statut ou nombre de candidats actifs, afin de prioriser les postes urgents.

### Sélection multi et bandeau flottant

19. Comme recruteur, je veux cocher plusieurs candidats et plusieurs besoins simultanément, afin de créer plusieurs matchings en une seule action.
20. Comme recruteur, je veux voir un bandeau flottant dès que j'ai au moins un candidat et un besoin sélectionnés, afin d'avoir un accès immédiat aux actions disponibles.
21. Comme recruteur, je veux que le bandeau affiche le décompte exact "X candidat(s) · Y besoin(s)", afin de valider visuellement ma sélection avant d'agir.
22. Comme recruteur, je veux pouvoir désélectionner tout en un clic depuis le bandeau, afin de recommencer ma sélection rapidement.
23. Comme recruteur, je veux que la sélection persiste pendant que je filtre ou trie les colonnes, afin de pouvoir affiner ma vue sans perdre ma sélection.

### Création de matchings en lot

24. Comme recruteur, je veux cliquer sur "Créer les matchings" dans le bandeau pour rattacher tous les candidats sélectionnés à tous les besoins sélectionnés, afin de gagner du temps.
25. Comme recruteur, je veux qu'un matching déjà existant pour une paire candidat/besoin soit silencieusement ignoré (pas d'erreur affichée), afin que la création en lot soit sans friction.
26. Comme recruteur, je veux voir visuellement sur les cartes les paires déjà rattachées (badge ou indicateur discret), afin d'éviter les doublons intentionnellement.
27. Comme recruteur, je veux recevoir une confirmation ("X matchings créés, Y déjà existants ignorés") après la création en lot, afin de savoir ce qui s'est passé.
28. Comme recruteur, je veux que la création d'un matching déclenche la synchronisation automatique du statut du besoin concerné (via `syncNeedStatusFromMatchings`), afin de garder le pipeline à jour.

### Upload de CV

29. Comme recruteur, je veux uploader un CV directement depuis la fiche candidat (page `/candidats/[id]`), afin de stocker le document dans l'ATS.
30. Comme recruteur, je veux que le CV uploadé soit stocké dans Supabase Storage et référencé dans la table `documents` avec `documentType = "cv"` et `candidateId`, afin de pouvoir le retrouver et le joindre aux emails.
31. Comme recruteur, je veux pouvoir uploader un CV directement dans la modale d'envoi d'email (pour les candidats sans CV), afin de ne pas bloquer le processus d'envoi.
32. Comme recruteur, je veux que le CV uploadé depuis la modale d'envoi alimente bien la fiche candidat (stocké dans `documents`), afin d'éviter la duplication des documents.
33. Comme recruteur, je veux voir un indicateur clair sur les cartes candidats de la page `/matching` indiquant la présence ou l'absence de CV, afin d'anticiper les uploads nécessaires avant d'envoyer.

### Envoi d'email — Gmail OAuth2

34. Comme recruteur, je veux que mon compte Google (déjà utilisé pour la connexion à l'ATS) soit autorisé à envoyer des emails via Gmail sans nouvelle authentification, afin de ne pas dupliquer les étapes de connexion.
35. Comme recruteur, je veux qu'au premier login Google (ou à la reconnexion), l'application demande l'accès `gmail.send` en plus de l'accès de base, afin de préparer l'envoi d'emails futur.
36. Comme recruteur, je veux cliquer sur "Envoyer les CV" dans le bandeau flottant pour déclencher le flow d'envoi, afin d'enchaîner directement après la création des matchings.
37. Comme recruteur, je veux que le flow génère **une email par besoin sélectionné** (et non par paire candidat/besoin), afin d'envoyer un message groupé à chaque entreprise.
38. Comme recruteur, je veux voir une modale d'aperçu et de confirmation avant l'envoi, afin d'éviter les envois accidentels.

### Modale d'envoi — par besoin

39. Comme recruteur, je veux voir le nom du besoin et de l'entreprise en en-tête de chaque section de la modale, afin de confirmer le destinataire.
40. Comme recruteur, je veux que le contact principal de l'entreprise (`isPrimary`) soit pré-sélectionné comme destinataire, afin de minimiser les clics.
41. Comme recruteur, je veux pouvoir changer le destinataire en choisissant parmi les contacts de l'entreprise qui ont un email renseigné, afin d'adapter selon la situation.
42. Comme recruteur, je veux qu'un modèle d'email (`mailTemplates` avec `audience = "company"`) soit pré-chargé dans les champs sujet et corps, afin de gagner du temps.
43. Comme recruteur, je veux pouvoir modifier le sujet et le corps de l'email avant l'envoi, afin d'adapter le message au contexte.
44. Comme recruteur, je veux voir la liste des CV joints (un par candidat sélectionné pour ce besoin), afin de vérifier les pièces jointes.
45. Comme recruteur, je veux que les candidats sans CV soient signalés dans la modale avec un bouton d'upload inline, afin de pouvoir compléter le dossier sans quitter le flow.
46. Comme recruteur, je veux uploader un CV manquant depuis la modale et voir le fichier s'ajouter immédiatement à la liste des pièces jointes, afin de continuer sans interruption.
47. Comme recruteur, je veux recevoir une confirmation de succès pour chaque email envoyé, afin de savoir que les entreprises ont bien été contactées.
48. Comme recruteur, je veux qu'un message d'erreur clair s'affiche si un envoi échoue (ex. token expiré, email invalide), afin de pouvoir corriger et relancer.

### Permissions et sécurité

49. Comme administrateur, je veux que seuls les utilisateurs avec un refresh token Gmail valide puissent déclencher l'envoi d'emails, afin d'éviter les envois non authentifiés.
50. Comme recruteur, je veux que mon refresh token Gmail soit stocké de façon sécurisée côté serveur, afin de ne pas exposer mes credentials.
51. Comme recruteur direction, je veux avoir accès à la page `/matching` et à toutes ses fonctionnalités métier, afin de superviser le travail de proposition (la direction a accès complet aux fonctions métier).

---

## Implementation Decisions

### Architecture de la page

- La page `/matching` est un Server Component qui charge les données initiales pour les deux colonnes en parallèle (un seul loader par colonne).
- Un Client Component `MatchingClient` reçoit les données et gère toute l'interactivité : sélection, filtres, bandeau, modales.
- Le filtrage et le tri sont gérés **côté client** (React state) — les datasets de candidats et besoins sont suffisamment petits pour ne pas nécessiter de pagination ou de filtrage serveur à ce stade.

### Loaders de données

**`loadCandidatesForMatching()`** — retourne pour chaque candidat :
- `id`, `firstName`, `lastName`, `status`, `cursusEnvisage`, `city`, `ownerId`, `ownerName`, `updatedAt`
- `hasCV: boolean` — existence d'un document `documentType = "cv"` dans `documents`
- `activeMatchingNeedIds: string[]` — liste des `needId` déjà matchés avec ce candidat (pour détection des doublons côté client)

**`loadNeedsForMatching()`** — retourne pour chaque besoin :
- `id`, `title`, `companyId`, `companyName`, `targetCursusId`, `targetCursusName`, `city`, `status`, `ownerId`, `ownerName`, `updatedAt`, `activeMatchingsCount`
- `activeMatchingCandidateIds: string[]` — liste des `candidateId` déjà matchés avec ce besoin (pour détection des doublons)

### Détection des doublons

Côté client, quand un candidat ET un besoin sont tous deux sélectionnés, et que `besoin.activeMatchingCandidateIds.includes(candidat.id)` (ou symétrique), la paire est signalée visuellement sur la carte (badge "Déjà rattaché"). La Server Action `batchCreateMatchings` ignore silencieusement les doublons (le UNIQUE constraint existant sur `(candidateId, needId)` est la source de vérité — l'action intercepte l'erreur de contrainte et continue).

### Création en lot

`batchCreateMatchings(pairs: { candidateId: string; needId: string }[])` — Server Action :
1. Filtre les paires déjà existantes via un `SELECT` groupé
2. Insère uniquement les nouvelles paires (INSERT en batch)
3. Pour chaque `needId` unique concerné par une insertion, appelle `syncNeedStatusFromMatchings`
4. Retourne `{ created: number; skipped: number }`

### Schéma — colonne `googleRefreshToken` sur `profiles`

Ajouter `googleRefreshToken: text("google_refresh_token")` à la table `profiles`. Cette colonne est nullable (absente si l'utilisateur n'a pas encore accordé le scope `gmail.send` ou s'il se connecte par email/password).

Migration Drizzle requise.

### OAuth Google — ajout du scope gmail.send

Modifier `auth/google/route.ts` pour passer :
- `scope: "openid email profile https://www.googleapis.com/auth/gmail.send"`
- `access_type: "offline"`
- `prompt: "consent"` (force la re-délivrance du refresh token si déjà consenti)

Le refresh token arrive dans le callback OAuth (`auth/callback/route.ts`). Après l'échange de code, extraire le `provider_refresh_token` depuis la session Supabase et le persister dans `profiles.googleRefreshToken` via un UPDATE.

### Envoi email via Gmail API

Server Action `sendMatchingEmails(params)` :
- `params.perBesoin`: tableau de `{ needId, recipientEmail, subject, body, cvAttachments: { fileName, storagePath }[] }`
- Pour chaque besoin : télécharger les fichiers depuis Supabase Storage, construire un MIME multipart, envoyer via `googleapis` (`gmail.users.messages.send`)
- Utiliser le refresh token stocké dans `profiles` de l'utilisateur connecté ; si absent → retourner une erreur actionnable ("Veuillez vous reconnecter avec Google pour activer l'envoi d'emails")
- Retourner un résultat par besoin : `{ needId, success: boolean, error?: string }`

### Upload de CV

Server Action `uploadCandidateCV(candidateId: string, formData: FormData)` :
- Extrait le fichier, valide le MIME (PDF, .doc, .docx acceptés), valide la taille (max 10 Mo)
- Upload vers Supabase Storage dans le bucket `documents`, chemin `candidates/{candidateId}/{uuid}.{ext}`
- INSERT dans `documents` : `{ candidateId, documentType: "cv", fileName, storagePath, mimeType, fileSize, createdBy }`
- Si un CV existe déjà pour ce candidat, écrase le `storagePath` (UPDATE) ou insère un nouveau document (l'UI affiche toujours le plus récent)
- Retourne `{ success: true, documentId }` ou `{ success: false, error }`

### Templates mail

La modale d'envoi charge les `mailTemplates` avec `audience IN ("company", "all")` et `active = true`. Le premier template de la liste est pré-sélectionné. Les champs `subject` et `body` sont éditables avant l'envoi (édition locale dans la modale, pas de persistance du template modifié).

### Navigation

Ajouter `/matching` à la navigation principale de l'app shell, avec un label "Matching" et une icône appropriée (ex. `ArrowLeftRight` de lucide-react).

---

## Testing Decisions

**Principe** : tester le comportement observable depuis le point d'entrée le plus haut possible. Les tests ne doivent pas connaître l'implémentation interne des Server Actions ni la structure des composants.

**Modules à tester :**

1. **`batchCreateMatchings`** — tester : création de N paires, ignorance silencieuse des doublons, retour du comptage `{ created, skipped }`, déclenchement de `syncNeedStatusFromMatchings` pour chaque needId unique.

2. **`uploadCandidateCV`** — tester : upload accepté pour PDF valide, rejet pour MIME non autorisé, rejet si taille > 10 Mo, insertion correcte dans `documents`.

3. **`sendMatchingEmails`** — tester (avec mock Gmail API) : construction correcte du MIME multipart, rejet si `googleRefreshToken` absent, rapport d'erreur par besoin si l'API Gmail échoue.

4. **`loadCandidatesForMatching` / `loadNeedsForMatching`** — tester : flag `hasCV` correct selon présence de document, `activeMatchingNeedIds` / `activeMatchingCandidateIds` corrects.

**Art existant** : les Server Actions du même projet (`matching/actions.ts`, `besoins/actions.ts`) constituent le modèle de référence pour les tests d'actions — mêmes patterns Drizzle, même `requireAuth`.

---

## Out of Scope

- **Drag-and-drop** entre les deux colonnes (remplacé par multi-select + batch, décision de grilling)
- **Pagination serveur** des colonnes (filtrage client suffisant à ce stade)
- **Suivi des emails envoyés** (table `mailSentLog`, open/click tracking) — à prévoir dans un chantier ultérieur
- **Modification des templates mail** depuis la page Matching (la gestion des templates est un module séparé)
- **Envoi depuis la fiche besoin ou candidat** (envoi uniquement depuis `/matching`)
- **Réponses et threads** Gmail — l'envoi est sortant uniquement
- **Notifications internes** à la création d'un matching (chantier notifications séparé)
- **Statistiques de conversion** par cursus / entreprise

---

## Further Notes

- Le champ `isPrimary` dans `companyContacts` est de type `text` (pas `boolean`) — la logique de pré-sélection doit vérifier `isPrimary IS NOT NULL AND isPrimary != ''` ou adapter selon la convention effective en base.
- Le scope `gmail.send` demandé au login avec `prompt: "consent"` peut surprendre les utilisateurs qui se reconnectent sans y attendre ; prévoir un message d'explication dans l'UI de login ou dans la modale d'envoi ("Reconnectez-vous avec Google pour activer l'envoi d'emails").
- L'ADR `0001-matching-entite-explicite.md` confirme que le Matching porte son propre cycle de vie — la création en lot doit respecter l'unicité de contrainte `(candidateId, needId)` et initialiser `propositionStatus = "cv_sent"` (valeur par défaut DB).
- L'ADR `0004-statut-candidat-derive-du-matching.md` rappelle que la création d'un matching (statut initial `cv_sent`) déclenche potentiellement la transition du statut du besoin vers `need_in_progress` via `syncNeedStatusFromMatchings` — à appeler pour chaque needId touché par le batch.

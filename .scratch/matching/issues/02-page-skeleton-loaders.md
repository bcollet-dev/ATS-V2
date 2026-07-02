# 02 — Page /matching : squelette, loaders et navigation

Status: ready-for-agent

## Parent

`.scratch/matching/PRD.md`

## What to build

Créer la page `/matching` avec un layout deux colonnes (candidats | besoins), les Server Actions de chargement des données, et le lien de navigation dans l'app shell.

### Layout

- Page Server Component qui charge les données des deux colonnes en parallèle
- Client Component `MatchingClient` qui reçoit les données et rend les deux colonnes
- Chaque colonne affiche une liste de cartes avec les informations clés du candidat ou du besoin
- Pas de sélection ni de filtres dans cette issue — juste l'affichage

### Carte candidat (colonne gauche)

Afficher par carte : prénom + nom, statut pipeline (badge coloré), cursus envisagé, ville, recruteur référent, indicateur de présence de CV (ex. icône paperclip ou badge "CV" si `hasCV = true`).

### Carte besoin (colonne droite)

Afficher par carte : titre du poste, nom de l'entreprise (badge), cursus cible, ville, statut pipeline (badge coloré), nombre de candidats actifs, recruteur référent.

### Loaders

**`loadCandidatesForMatching()`** — retourne pour chaque candidat non supprimé :
- Champs identité : `id`, `firstName`, `lastName`, `status`, `cursusEnvisage`, `city`, `ownerId`, `ownerName`, `updatedAt`
- `hasCV: boolean` — `true` si au moins un document `documentType = "cv"` existe pour ce candidat dans la table `documents`
- `activeMatchingNeedIds: string[]` — liste des `needId` des matchings actifs (hors `not_retained`) de ce candidat — utilisée côté client pour détecter les doublons visuellement

**`loadNeedsForMatching()`** — retourne pour chaque besoin non supprimé :
- Champs : `id`, `title`, `companyId`, `companyName`, `targetCursusId`, `targetCursusName`, `city`, `status`, `ownerId`, `ownerName`, `updatedAt`, `activeMatchingsCount`
- `activeMatchingCandidateIds: string[]` — liste des `candidateId` des matchings actifs (hors `not_retained`) de ce besoin

### Navigation

Ajouter une entrée "Matching" (icône `ArrowLeftRight` de lucide-react) dans la navigation principale de l'app shell, pointant vers `/matching`.

## Acceptance criteria

- [ ] La page `/matching` est accessible et rendue sans erreur
- [ ] La colonne gauche affiche les candidats avec tous les champs listés, y compris l'indicateur de CV
- [ ] La colonne droite affiche les besoins avec tous les champs listés
- [ ] `hasCV` est correct (true si un document cv existe, false sinon)
- [ ] `activeMatchingNeedIds` et `activeMatchingCandidateIds` sont corrects (listes à jour, hors `not_retained`)
- [ ] L'entrée "Matching" apparaît dans la navigation principale et redirige vers `/matching`
- [ ] Les données des deux colonnes sont chargées en parallèle (pas en séquence)

## Blocked by

None — can start immediately

# 05 — Upload de CV sur la fiche candidat

Status: ready-for-agent

## Parent

`.scratch/matching/PRD.md`

## What to build

Permettre l'upload d'un CV depuis la fiche candidat (`/candidats/[id]`). Le fichier est stocké dans Supabase Storage et référencé dans la table `documents`. Le flag `hasCV` sur la page `/matching` se met à jour automatiquement après upload.

### Server Action `uploadCandidateCV`

```
uploadCandidateCV(candidateId: string, formData: FormData)
  → { success: true; documentId: string } | { success: false; error: string }
```

Comportement :
1. Extraire le fichier depuis `formData`
2. Valider le MIME type : accepter `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` uniquement
3. Valider la taille : max 10 Mo
4. Générer un chemin de stockage : `candidates/{candidateId}/{uuid}.{ext}`
5. Uploader vers le bucket Supabase Storage `documents`
6. Vérifier si un CV existe déjà pour ce candidat dans la table `documents` (`documentType = "cv"`, `candidateId`) :
   - S'il existe : mettre à jour le record existant (`storagePath`, `fileName`, `mimeType`, `fileSize`)
   - S'il n'existe pas : insérer un nouveau record
7. Revalider le path `/candidats/[id]` et `/matching`

### UI sur la fiche candidat

Dans la section documents de `/candidats/[id]` (ou créer cette section si elle n'existe pas encore), afficher :
- Si un CV existe : nom du fichier + date d'upload + bouton "Remplacer"
- Si aucun CV : bouton "Uploader un CV" avec une zone de dépôt de fichier (drag or click)
- Feedback pendant l'upload (état de chargement)
- Message d'erreur si MIME invalide ou taille dépassée

### Indicateur sur la page /matching

L'indicateur `hasCV` sur les cartes candidats de `/matching` (ajouté à l'issue #02) se met à jour automatiquement via `router.refresh()` après un upload réussi, puisque `loadCandidatesForMatching` relit la table `documents`.

## Acceptance criteria

- [ ] Un fichier PDF, .doc ou .docx peut être uploadé depuis `/candidats/[id]`
- [ ] Un fichier d'un type non autorisé est rejeté avec un message d'erreur clair
- [ ] Un fichier > 10 Mo est rejeté avec un message d'erreur clair
- [ ] Le fichier est bien présent dans Supabase Storage au chemin `candidates/{candidateId}/{uuid}.{ext}`
- [ ] Un record `documentType = "cv"` existe dans la table `documents` avec le bon `candidateId`
- [ ] Si un CV existait déjà, il est remplacé (un seul record CV par candidat — pas de doublon en base)
- [ ] L'indicateur "CV" sur la carte candidat de `/matching` passe à `true` après upload (après refresh)
- [ ] L'UI de la fiche candidat distingue clairement l'état "avec CV" vs "sans CV"

## Blocked by

- Issue #02 (flag `hasCV` dans les loaders requis pour la cohérence du flow)

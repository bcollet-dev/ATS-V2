# 06 — Flow d'envoi d'email Gmail par besoin

Status: ready-for-agent

## Parent

`.scratch/matching/PRD.md`

## What to build

Permettre l'envoi des CV des candidats sélectionnés aux contacts des entreprises concernées, directement depuis la page `/matching`, via Gmail OAuth2. L'envoi produit **un email par besoin sélectionné**.

### Déclencheur

Le bouton "Envoyer les CV" dans le bandeau flottant (placeholder dans l'issue #04) devient actif dans cette issue. Il est accessible dès que la sélection contient au moins 1 candidat et 1 besoin.

### Modale d'envoi

La modale est organisée en sections — une par besoin sélectionné. Chaque section contient :

**En-tête** : titre du besoin + nom de l'entreprise

**Destinataire** : sélecteur parmi les contacts de l'entreprise qui ont un email renseigné. Le contact dont le champ `isPrimary` est non nul est pré-sélectionné. Si aucun contact n'a d'email, afficher un message "Aucun contact avec email — ajoutez un contact à la fiche entreprise".

**Template** : sélecteur parmi les `mailTemplates` actifs avec `audience IN ("company", "all")`. Le premier de la liste est pré-sélectionné. La sélection d'un template remplace les champs sujet et corps.

**Sujet** : champ texte pré-rempli depuis le template, éditable.

**Corps** : textarea pré-rempli depuis le template, éditable.

**Pièces jointes** : liste des CV des candidats sélectionnés pour ce besoin. Pour chaque candidat :
- S'il a un CV : afficher `fileName` avec une icône de fichier
- S'il n'a pas de CV : afficher le nom du candidat + bouton "Uploader un CV" inline

Upload inline dans la modale : même Server Action `uploadCandidateCV` qu'en issue #05. Après upload réussi, le fichier s'ajoute immédiatement à la liste des pièces jointes sans fermer la modale.

**Bouton d'envoi** par section : "Envoyer à [nom du contact]". Un bouton global "Envoyer tous" envoie toutes les sections d'un coup.

### Server Action `sendMatchingEmails`

Installe la dépendance `googleapis` si elle n'est pas encore présente.

```
sendMatchingEmails(params: {
  senderUserId: string;
  emails: {
    needId: string;
    recipientEmail: string;
    subject: string;
    body: string;
    cvDocumentIds: string[];
  }[]
}) → { results: { needId: string; success: boolean; error?: string }[] }
```

Comportement par email :
1. Charger le `googleRefreshToken` de l'utilisateur depuis `profiles`
2. Si absent → retourner `{ success: false, error: "Reconnectez-vous avec Google pour activer l'envoi d'emails" }`
3. Initialiser le client OAuth2 `googleapis` avec le client ID/secret d'env et le refresh token ; appeler `oauth2Client.getAccessToken()` pour obtenir un access token frais
4. Pour chaque `cvDocumentId` : charger le `storagePath` depuis `documents`, télécharger le fichier depuis Supabase Storage
5. Construire un email MIME multipart/mixed : headers (`From`, `To`, `Subject`), partie `text/html` pour le corps, une partie `application/octet-stream` par pièce jointe encodée en base64
6. Envoyer via `gmail.users.messages.send` avec le message encodé en base64url
7. Retourner `{ success: true }` ou `{ success: false, error: message_api }`

Les credentials OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) sont des variables d'env — ne jamais les coder en dur.

### Gestion d'erreur

- Token absent → message actionnable dans la modale ("Reconnectez-vous avec Google…")
- Erreur API Gmail par besoin → signaler l'échec uniquement pour ce besoin, les autres sont envoyés
- Email destinataire invalide → l'erreur remonte depuis l'API Gmail dans `error`

### Feedback

Après envoi global : pour chaque besoin, afficher ✓ (succès) ou ✗ + message d'erreur. Un toast récapitulatif "X emails envoyés, Y échec(s)" est affiché.

## Acceptance criteria

- [ ] Le bouton "Envoyer les CV" dans le bandeau flottant ouvre la modale
- [ ] La modale affiche une section par besoin sélectionné
- [ ] Le contact principal de l'entreprise est pré-sélectionné comme destinataire
- [ ] Le changement de template met à jour les champs sujet et corps
- [ ] Les champs sujet et corps sont éditables sans modifier le template en base
- [ ] Les candidats avec CV affichent leur fichier dans la liste des pièces jointes
- [ ] Les candidats sans CV affichent un bouton d'upload inline fonctionnel
- [ ] L'upload inline ajoute le fichier aux pièces jointes sans fermer la modale
- [ ] Si `googleRefreshToken` est absent, un message actionnable est affiché (pas de crash)
- [ ] Un email est bien reçu côté entreprise avec les pièces jointes attendues (test manuel)
- [ ] En cas d'échec sur un besoin, les autres besoins sont quand même envoyés
- [ ] Le feedback par besoin (✓ / ✗) est affiché après l'envoi

## Blocked by

- Issue #01 (OAuth Gmail + refresh token requis)
- Issue #04 (sélection multi + bandeau flottant requis)
- Issue #05 (Server Action `uploadCandidateCV` requise pour l'upload inline)

# 02 — Envoi de la notification candidat lors du matching

Status: ready-for-agent

## Parent

`.scratch/notif-candidat-cv/PRD.md`

## What to build

Lors de l'envoi de CVs via le modal Matching, envoyer automatiquement un email de notification à chaque candidat concerné (un email par couple candidat × besoin), en utilisant la trame "notification CV par défaut" configurée dans `/trames-mail`.

**Modal d'envoi (`SendEmailModal`) :**
- Ajouter une case à cocher "Notifier les candidats par email", pré-cochée par défaut, état local.
- Afficher un avertissement discret (non-bloquant) si un ou plusieurs candidats inclus n'ont pas d'email renseigné : "X candidat(s) sans email — pas de notification possible".
- Enrichir le payload envoyé à `sendMatchingEmails` :
  - `notifyCandidates: boolean` (état de la case)
  - `candidateIds: string[]` par email (liste des IDs des candidats inclus pour ce besoin, après exclusions)

**`sendMatchingEmails` (action serveur) :**

Nouveaux paramètres dans le shape (décision d'interface issue du PRD) :
```ts
params: {
  notifyCandidates: boolean;
  emails: {
    needId: string;
    recipientEmail: string;
    candidateIds: string[];   // nouveau
    // ...champs existants inchangés
  }[];
}
```

Logique ajoutée après le loop d'envoi existant :
1. Si `notifyCandidates = false` ou si `loadDefaultCvNotificationTemplate()` retourne `null` → skip silencieux, aucune erreur.
2. Fetch des emails + prénom + nom pour tous les `candidateIds` uniques du batch.
3. Pour chaque email entreprise **réussi** : pour chaque candidat de cet envoi avec un email renseigné, envoyer une notification via le même transporter OAuth2 Gmail du consultant.
4. Variables du contexte par notification (substituées via `substituteVariables`) :
   - `prenom_candidat`, `nom_candidat` (candidat destinataire)
   - `nom_entreprise`, `ville_entreprise`, `siret_entreprise`, `titre_poste`, `ville_poste`, `date_debut`, `date_fin`, `type_contrat` (du besoin)
   - `prenom_contact`, `nom_contact` (contact entreprise de cet envoi)
   - `prenom_consultant`, `nom_consultant`, `nom_ecole`
5. Signature du consultant injectée via `renderSignatureHtml` (même que les emails entreprise).
6. Les échecs de notification candidat sont logués en console — non-bloquants, ne remontent pas dans le tableau `results` retourné.

## Acceptance criteria

- [ ] La case "Notifier les candidats" est visible et pré-cochée dans le modal d'envoi
- [ ] Décocher la case → aucune notification envoyée, l'envoi entreprise n'est pas affecté
- [ ] Si un candidat inclus n'a pas d'email : avertissement affiché dans le modal (non-bloquant)
- [ ] Après un envoi réussi à l'entreprise : chaque candidat inclus avec email reçoit un email de notification
- [ ] Si l'email entreprise a échoué : aucune notification n'est envoyée pour ce besoin
- [ ] Les variables `{{prenom_candidat}}`, `{{nom_entreprise}}`, `{{titre_poste}}`, `{{prenom_contact}}`, `{{nom_contact}}` sont correctement substituées dans la notification
- [ ] La signature du consultant apparaît dans la notification candidat
- [ ] Si aucune trame par défaut n'est configurée : l'envoi entreprise fonctionne normalement, aucune erreur
- [ ] L'expéditeur de la notification est le Gmail OAuth du consultant (même `from` que les emails entreprise)
- [ ] Un candidat exclu du send (via la case d'exclusion dans le modal) ne reçoit pas de notification

## Blocked by

- `.scratch/notif-candidat-cv/issues/01-trame-defaut-cv-notification.md` — besoin de `loadDefaultCvNotificationTemplate()`

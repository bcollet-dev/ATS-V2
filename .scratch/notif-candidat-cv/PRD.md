# PRD — Notification candidat "CV envoyé"

Status: ready-for-agent

## Problem Statement

Quand un consultant envoie des CVs à une entreprise depuis la page Matching, les candidats concernés n'en sont pas informés. Le candidat découvre souvent par hasard que sa candidature a été transmise, ce qui nuit à la confiance et à la qualité du suivi.

## Solution

Lors de chaque envoi de CV via le modal Matching, un email de notification est automatiquement envoyé à chaque candidat concerné (un email par couple candidat × besoin). Le consultant peut désactiver cette notification via une case à cocher pré-cochée dans le modal. Le contenu de l'email est géré via une trame dédiée dans `/trames-mail`, marquée comme "notification CV par défaut".

## User Stories

1. En tant que consultant, je veux qu'un email soit automatiquement envoyé au candidat quand je transmets son CV à une entreprise, afin qu'il soit informé en temps réel de l'avancement de sa candidature.
2. En tant que consultant, je veux pouvoir décocher "Notifier les candidats" dans le modal d'envoi, afin de pouvoir envoyer un CV sans notification dans les cas où ce n'est pas opportun.
3. En tant que consultant, je veux voir un avertissement dans le modal si un ou plusieurs candidats n'ont pas d'email renseigné, afin de savoir qu'ils ne recevront pas de notification.
4. En tant que consultant, je veux que la notification parte depuis mon adresse Gmail (OAuth), afin que le candidat puisse me répondre directement.
5. En tant que consultant, je veux recevoir un email par besoin concerné (et non un seul email récapitulatif), afin que chaque notification soit précise et contextualisée.
6. En tant que consultant, je veux que la notification candidat ne parte que si l'email à l'entreprise a réussi, afin d'éviter de notifier un candidat pour un envoi qui a échoué.
7. En tant qu'administrateur, je veux pouvoir créer et modifier la trame "notification CV par défaut" dans `/trames-mail`, afin de personnaliser le message envoyé aux candidats.
8. En tant qu'administrateur, je veux pouvoir désigner une trame existante comme "notification CV par défaut" via un toggle dans la fiche trame, afin que cette trame soit automatiquement utilisée lors des envois.
9. En tant qu'administrateur, je veux qu'une seule trame puisse être marquée "par défaut" à la fois, afin d'éviter toute ambiguïté sur la trame utilisée.
10. En tant que consultant, je veux voir clairement quelle trame est désignée "notification CV par défaut" dans la liste des trames, afin de savoir laquelle sera utilisée.
11. En tant que candidat, je veux recevoir un email personnalisé mentionnant le nom de l'entreprise, le poste et le contact à qui mon CV a été envoyé, afin de pouvoir me préparer à un éventuel appel.
12. En tant que candidat, je veux que l'email soit signé par mon consultant avec sa signature personnalisée, afin de savoir qui est mon interlocuteur.
13. En tant que consultant, je veux pouvoir utiliser toutes les variables matching dans la trame (nom entreprise, titre poste, contact, etc.), afin de rédiger un email riche et précis.
14. En tant que consultant, je veux que si aucune trame "par défaut" n'est configurée, la notification candidat soit silencieusement ignorée (pas d'erreur bloquante), afin que l'envoi principal ne soit pas impacté.

## Implementation Decisions

### Schéma DB
- Ajout d'un champ `is_default_cv_notification boolean default false` sur la table `mail_templates`.
- Un seul enregistrement peut avoir ce flag à `true` : appliqué au niveau applicatif (pas de contrainte DB unique partielle — trop fragile sur les mises à jour concurrentes). L'action `setDefaultCvNotification(id)` remet le flag à `false` sur toutes les autres trames avant de le mettre à `true` sur la cible, dans une transaction.

### Type `MailTemplateRow`
Le type existant est étendu avec `isDefaultCvNotification: boolean`.

### Actions trames-mail
- Nouvelle action `setDefaultCvNotification(id)` : transaction DB, toggle exclusif.
- `listMailTemplates` : sélectionne le nouveau champ.
- `loadDefaultCvNotificationTemplate()` : retourne la trame marquée par défaut, ou `null`.

### Trame drawer (`TrameDrawer`)
- Nouveau toggle "Utiliser comme notification CV par défaut" visible uniquement en mode édition (rôles canEdit). S'affiche dans le footer à gauche, aux côtés du bouton Archiver.
- Quand activé : appelle `setDefaultCvNotification(id)` + toast de confirmation.
- Badge dans la liste des trames pour la trame désignée.

### Payload `sendMatchingEmails`
Ajout de deux champs :
```ts
// Extrait du shape (prototype — décision d'interface)
params: {
  notifyCandidates: boolean;
  emails: {
    needId: string;
    recipientEmail: string;
    candidateIds: string[];   // ← NOUVEAU : IDs des candidats inclus dans cet envoi
    // ... champs existants inchangés
  }[];
}
```
`candidateIds` est fourni par le modal client qui gère déjà la liste des candidats inclus/exclus.

### Logique de notification dans `sendMatchingEmails`
1. Si `notifyCandidates = false` ou si aucune trame par défaut n'existe : skip silencieux.
2. Fetch unique des emails candidats (`candidates.email`, `candidates.firstName`, `candidates.lastName`) pour tous les `candidateIds` de l'ensemble du batch.
3. Pour chaque email entreprise **réussi** : pour chaque `candidateId` de cet envoi dont l'email est renseigné, envoyer une notification via le même transporter OAuth2.
4. Variables du contexte candidat (toutes substituées via `substituteVariables`) :
   - `prenom_candidat`, `nom_candidat` (du candidat destinataire)
   - `nom_entreprise`, `ville_entreprise`, `siret_entreprise`, `titre_poste`, `ville_poste`, `date_debut`, `date_fin`, `type_contrat` (du besoin)
   - `prenom_contact`, `nom_contact` (du contact entreprise de cet envoi)
   - `prenom_consultant`, `nom_consultant`, `nom_ecole`
5. La signature du consultant (`renderSignatureHtml`) est injectée comme sur les autres envois.
6. Les échecs de notification candidat sont logués en console (non-bloquants, ne remontent pas dans `results`).

### Modal d'envoi (`SendEmailModal`)
- Case à cocher "Notifier les candidats par email" pré-cochée, état local.
- Warning discret (non-bloquant) listé sous les candidats si `candidates.email` est null/vide pour au moins un candidat inclus. Texte : "X candidat(s) sans email — pas de notification possible".
- Le champ `candidateIds` de chaque email est construit à partir des `includedCandidates` filtrés (après exclusions).

### Variables disponibles dans la trame
Les 19 variables existantes dans `/trames-mail` sont toutes utilisables. Dans le contexte candidat, les variables `{{prenom_candidat}}` et `{{nom_candidat}}` sont désormais résolues (candidat = destinataire unique).

## Testing Decisions

- **Bonne approche** : tester le comportement observable (email envoyé ou non, payload correct) plutôt que l'implémentation interne.
- **Seam principal** : `sendMatchingEmails` — tester avec `notifyCandidates: true/false`, candidat avec/sans email, trame par défaut présente/absente.
- **Seam secondaire** : `setDefaultCvNotification` — vérifier l'exclusivité (une seule trame à true après appel).
- **Prior art** : pas de tests automatisés dans le projet actuellement — les tests sont manuels via le dev server.

## Out of Scope

- Email récapitulatif multi-besoins (une notif par besoin, pas de groupement).
- Historique des notifications envoyées aux candidats (pas de table de log dédiée).
- Opt-out candidat (le candidat ne peut pas se désabonner de ces notifications).
- Notification candidat lors d'autres événements (refus, sélection, etc.).
- Personnalisation par candidat de la trame (une seule trame partagée).

## Further Notes

- Si le consultant n'a pas de `googleRefreshToken`, les notifications candidats échouent silencieusement comme les emails entreprise.
- La trame de notification a l'audience `candidate` dans `/trames-mail` — le filtre d'audience existant la met naturellement dans la bonne catégorie.
- `{{email_candidat}}` et `{{telephone_candidat}}` ne sont pas injectés dans ce contexte (le candidat est le destinataire, pas utile de lui envoyer son propre email).

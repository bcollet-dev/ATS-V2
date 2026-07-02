# PRD — Trames mail

Status: ready-for-agent

## Problem Statement

Les consultants doivent envoyer des emails récurrents (envoi de CV, relances, convocations) depuis plusieurs surfaces de l'ATS, mais il n'existe aucun endroit centralisé pour créer, retrouver ou réutiliser des modèles d'email. Les trames sont actuellement saisies à la main à chaque envoi, sans cohérence ni traçabilité. Il n'existe pas non plus de moyen de configurer sa signature personnelle, qui doit donc être recopiée manuellement.

## Solution

Une page dédiée `/trames-mail` avec deux onglets :

1. **Trames** — bibliothèque centrale de modèles d'email (nom, objet, corps rich text, catégorie, audience). Les consultants autorisés peuvent créer, éditer et archiver des trames. Un éditeur rich text (Tiptap) permet de composer le corps avec des variables dynamiques cliquables (`{{prenom_candidat}}`, `{{titre_poste}}`, etc.) qui sont substituées automatiquement à l'envoi selon le contexte (matching, fiche candidat, fiche besoin…).

2. **Paramétrage** — chaque utilisateur peut coller sa signature email en HTML. Elle est stockée par utilisateur et injectée automatiquement à la fin du corps lors de chaque envoi.

## User Stories

1. En tant que consultant, je veux accéder à une bibliothèque de trames email depuis `/trames-mail`, afin de ne pas réécrire les mêmes emails à chaque envoi.
2. En tant que consultant, je veux voir la liste des trames avec leur nom, catégorie, audience et date de modification, afin de trouver rapidement celle dont j'ai besoin.
3. En tant que consultant admissions/team_leader/admin, je veux créer une nouvelle trame depuis un bouton "Nouvelle trame", afin d'enrichir la bibliothèque partagée.
4. En tant que consultant admissions/team_leader/admin, je veux éditer une trame existante dans un drawer latéral, afin de corriger ou mettre à jour un modèle.
5. En tant que consultant admissions/team_leader/admin, je veux archiver une trame (la rendre inactive), afin qu'elle disparaisse du sélecteur d'envoi sans être définitivement perdue.
6. En tant qu'admin, je veux supprimer définitivement une trame archivée, afin de nettoyer les modèles obsolètes.
7. En tant que consultant admissions/team_leader/admin, je veux rédiger le corps d'une trame dans un éditeur rich text (gras, italique, souligné, listes, liens), afin de produire des emails bien formatés.
8. En tant que consultant, je veux insérer une variable dynamique (`{{nom_candidat}}`, `{{titre_poste}}`…) depuis un panneau latéral avec champ de recherche, afin de personnaliser l'email sans mémoriser les noms de variables.
9. En tant que consultant, je veux que chaque variable affiche un exemple concret (ex: `{{nom_candidat}}` — "COLLET"), afin de comprendre ce qui sera substitué à l'envoi.
10. En tant que consultant, je veux assigner une catégorie à une trame (Envoi CV, Relance, Convocation entretien, Accueil, Autre…), afin d'organiser la bibliothèque.
11. En tant qu'admin ou direction, je veux créer une nouvelle catégorie directement depuis le champ de saisie (combobox libre), afin d'adapter l'organisation sans intervention technique.
12. En tant que consultant, je veux spécifier l'audience d'une trame (`candidate`, `company`, `need`, `all`), afin que la trame apparaisse dans le bon contexte d'envoi.
13. En tant que consultant, je veux sélectionner une trame dans le modal d'envoi du matching, afin de pré-remplir l'objet et le corps de l'email en un clic.
14. En tant que consultant, je veux que les variables de la trame soient substituées automatiquement lors de l'envoi, afin que chaque destinataire reçoive un email personnalisé.
15. En tant que consultant, je veux que ma signature personnelle soit automatiquement ajoutée à la fin de chaque email envoyé, afin de ne pas avoir à la recopier à chaque fois.
16. En tant que consultant, je veux configurer ma signature email en HTML (copier-coller depuis Gmail/Outlook) depuis l'onglet "Paramétrage", afin de conserver la mise en forme de ma signature existante.
17. En tant que consultant, je veux prévisualiser ma signature HTML dans l'interface avant de la sauvegarder, afin de vérifier le rendu.
18. En tant que consultant direction, je veux accéder à la liste des trames en lecture seule, afin d'avoir une vue sur les communications de l'équipe.
19. En tant que consultant, je veux voir distinctement les trames actives et archivées (onglet ou filtre), afin de retrouver un ancien modèle si nécessaire.
20. En tant que consultant, je veux filtrer les trames par catégorie ou audience depuis la liste, afin de naviguer rapidement dans une bibliothèque qui grandit.
21. En tant qu'admin, je veux savoir qui a créé chaque trame (auteur + date), afin de maintenir la cohérence de la bibliothèque.
22. En tant que consultant, je veux que les trames sauvegardées depuis le modal d'envoi matching soient accessibles dans la bibliothèque `/trames-mail`, afin d'avoir une source unique de vérité.

## Implementation Decisions

### Schema

- Ajouter la colonne `email_signature text` à la table `profiles` (migration Drizzle). Valeur nulle si non configurée.
- La table `mailTemplates` est déjà en place avec tous les champs nécessaires (`name`, `subject`, `body`, `category`, `audience`, `active`, `createdBy`, `createdAt`, `updatedAt`, `deletedAt`). Aucune modification de schema requise pour elle.

### Variables dynamiques

Jeu de variables fixe, substitution par remplacement de chaîne côté serveur avant l'envoi :

| Variable | Source | Exemple |
|---|---|---|
| `{{prenom_candidat}}` | `candidates.firstName` | "Baptiste" |
| `{{nom_candidat}}` | `candidates.lastName` | "COLLET" |
| `{{email_candidat}}` | `candidates.email` | "b.collet@gmail.com" |
| `{{telephone_candidat}}` | `candidates.phone` | "06 12 34 56 78" |
| `{{cursus_candidat}}` | `candidates.cursusEnvisage` | "BTS Management" |
| `{{ville_candidat}}` | `candidates.city` | "Lyon" |
| `{{titre_poste}}` | `needs.title` | "Assistant RH" |
| `{{ville_poste}}` | `needs.city` | "Paris" |
| `{{date_debut}}` | `needs.startDate` | "01/09/2026" |
| `{{date_fin}}` | `needs.endDate` | "31/08/2028" |
| `{{type_contrat}}` | `needs.contractType` | "Apprentissage" |
| `{{nom_entreprise}}` | `companies.name` | "EDA Groupe" |
| `{{ville_entreprise}}` | `companies.city` | "Paris" |
| `{{siret_entreprise}}` | `companies.siret` | "123 456 789 00012" |
| `{{prenom_contact}}` | `companyContacts.firstName` | "Marie" |
| `{{nom_contact}}` | `companyContacts.lastName` | "DUPONT" |
| `{{prenom_consultant}}` | `profiles.fullName` (split) | "Jean" |
| `{{nom_consultant}}` | `profiles.fullName` (split) | "MARTIN" |
| `{{nom_ecole}}` | Constante app ("EDA Groupe") | "EDA Groupe" |

Une fonction utilitaire partagée `substituteVariables(html: string, context: Record<string, string>): string` applique les remplacements. Elle est appelée côté serveur dans `sendMatchingEmails` avant l'envoi.

### Éditeur rich text

- Bibliothèque : **Tiptap** (`@tiptap/react`, `@tiptap/starter-kit` + extensions `Underline`, `Link`).
- Sortie : HTML string, stockée dans `mailTemplates.body`.
- Les variables `{{…}}` sont insérées comme texte brut (pas de nœud spécial) — Tiptap les préserve naturellement.
- Le panneau de variables (recherche + liste + exemple) est adjacent à l'éditeur dans le drawer. Un clic insère la variable à la position courante du curseur via `editor.commands.insertContent('{{variable}}')`.

### Éditeur de signature

- Interface : `<textarea>` pour HTML brut (copier-coller depuis Gmail/Outlook).
- Prévisualisation : un `<div dangerouslySetInnerHTML>` en lecture seule à côté.
- Stockage : `profiles.email_signature` (text, nullable).
- Injection : ajoutée à la fin du corps HTML dans la server action d'envoi, séparée par `<hr>` ou `<br><br>`.

### Permissions

| Action | Rôles autorisés |
|---|---|
| Lire la liste des trames | Tous |
| Créer / modifier / archiver une trame | `admin`, `team_leader`, `admissions` |
| Créer une catégorie (combobox libre) | `admin`, `direction` |
| Supprimer définitivement une trame | `admin` uniquement |
| Configurer sa propre signature | Tous |

### Nouvelles server actions (`/trames-mail/actions.ts`)

- `listMailTemplates({ includeArchived?: boolean })` — liste avec filtre actif/archivé
- `createMailTemplate(data)` — vérifie le rôle
- `updateMailTemplate(id, data)` — vérifie le rôle
- `archiveMailTemplate(id)` — passe `active = false`
- `deleteMailTemplate(id)` — suppression définitive, admin only, vérifie `active = false` d'abord
- `saveEmailSignature(html: string)` — met à jour `profiles.email_signature` pour l'utilisateur courant
- `loadEmailSignature()` — retourne la signature de l'utilisateur courant

### Catégories

Pas de table dédiée. Les catégories disponibles sont dérivées des valeurs distinctes de `mailTemplates.category` dans `listMailTemplates`. L'UI expose un combobox qui propose ces valeurs et permet la saisie libre (pour admin et direction).

### Modification de `sendMatchingEmails`

1. Charger la signature de l'expéditeur.
2. Construire le `context` de substitution à partir du matching sélectionné.
3. Appeler `substituteVariables(body, context)`.
4. Appender la signature.
5. Envoyer via nodemailer avec `html: finalBody`.

### Structure de la page

- Page Server Component : charge la liste des trames et les passe au Client Component.
- Client Component avec deux onglets : **Trames** (liste + drawer) et **Paramétrage** (signature).
- Drawer de création/édition : fields `name`, `subject`, `category` (combobox), `audience` (select), éditeur Tiptap + panneau variables.
- Filtres dans la liste : catégorie, audience, actif/archivé.

## Testing Decisions

Les tests à valeur ajoutée pour cette feature testent le comportement observable, pas l'implémentation interne.

**Ce qui fait un bon test ici :** tester les server actions à leur interface publique (entrées/sorties, effets en base) et la fonction `substituteVariables` via ses entrées/sorties.

**Modules à tester :**

- `substituteVariables` — test unitaire : entrée template HTML avec variables connues + context → vérifier la sortie substituée. Cas aux limites : variable inconnue (laisser telle quelle), HTML complexe (ne pas casser les balises), valeur vide (laisser vide).
- Server actions `createMailTemplate`, `updateMailTemplate`, `archiveMailTemplate`, `deleteMailTemplate` — tester les vérifications de rôle (un rôle non autorisé doit recevoir une erreur, pas modifier la base).
- `saveEmailSignature` — vérifier que la valeur est bien stockée pour le bon utilisateur.

**Prior art :** pas de tests automatisés en place dans le projet actuellement. Ces tests seraient les premiers — à mettre dans `src/__tests__/` ou colocalisés.

## Out of Scope

- Intégration Gmail OAuth (BlocGmail est un placeholder "en attente validation DPO") — les surfaces candidat/annuaire/besoin ne sont pas connectées dans ce PRD.
- Versionnement des trames (historique des modifications).
- Trames partagées vs trames personnelles — toutes les trames sont partagées dans cette version.
- Envoi programmé / planifié.
- Pièces jointes configurables dans les trames (les PJ sont gérées au moment de l'envoi dans SendEmailModal).
- Analytics sur l'utilisation des trames (combien de fois utilisée, taux d'ouverture…).

## Further Notes

- Le champ `audience` de `mailTemplates` prépare le filtrage contextuel futur : quand BlocGmail sera actif sur les fiches candidat, on ne proposera que les trames `candidate` ou `all`. Pour l'instant c'est un tag visuel et un filtre manuel.
- La sauvegarde depuis le modal matching (`saveMailTemplate`) crée déjà des trames avec `audience: "all"` et sans catégorie — ces trames apparaîtront dans la bibliothèque, éditables depuis `/trames-mail`.
- Tiptap doit être en `serverExternalPackages` si des problèmes de bundling apparaissent (pattern déjà utilisé pour `pdf-lib`).
- Le HTML de la signature doit être sanitisé avant stockage pour éviter les XSS (DOMPurify côté client ou une lib serveur légère).

# 02 — CRUD trames : création, édition, archivage, suppression

Status: ready-for-agent

## Parent

`.scratch/trames-mail/PRD.md`

## What to build

Rendre les trames entièrement éditables via un drawer latéral. Le bouton "Nouvelle trame" et le clic sur une trame existante ouvrent ce drawer.

**Drawer de création/édition :**
- Champ `name` (texte)
- Champ `subject` (texte — objet de l'email)
- Champ `category` — combobox : propose les valeurs distinctes existantes dans `mailTemplates.category` en suggestions, permet la saisie libre pour les rôles `admin` et `direction` (les autres rôles ne peuvent choisir que dans les valeurs existantes)
- Champ `audience` — select parmi `candidate`, `company`, `need`, `all`
- Éditeur de corps **Tiptap** rich text (StarterKit + Underline + Link) — sortie HTML stockée dans `body`
- Panneau "Variables disponibles" adjacent à l'éditeur : champ de recherche + liste scrollable de toutes les variables avec leur exemple (ex: `{{nom_candidat}}` — "COLLET"). Clic sur une variable → `editor.commands.insertContent('{{variable}}')` à la position courante du curseur

**Variables exposées (19 au total) :**

| Variable | Exemple |
|---|---|
| `{{prenom_candidat}}` | "Baptiste" |
| `{{nom_candidat}}` | "COLLET" |
| `{{email_candidat}}` | "b.collet@gmail.com" |
| `{{telephone_candidat}}` | "06 12 34 56 78" |
| `{{cursus_candidat}}` | "BTS Management" |
| `{{ville_candidat}}` | "Lyon" |
| `{{titre_poste}}` | "Assistant RH" |
| `{{ville_poste}}` | "Paris" |
| `{{date_debut}}` | "01/09/2026" |
| `{{date_fin}}` | "31/08/2028" |
| `{{type_contrat}}` | "Apprentissage" |
| `{{nom_entreprise}}` | "EDA Groupe" |
| `{{ville_entreprise}}` | "Paris" |
| `{{siret_entreprise}}` | "123 456 789 00012" |
| `{{prenom_contact}}` | "Marie" |
| `{{nom_contact}}` | "DUPONT" |
| `{{prenom_consultant}}` | "Jean" |
| `{{nom_consultant}}` | "MARTIN" |
| `{{nom_ecole}}` | "EDA Groupe" |

**Server actions :**
- `createMailTemplate(data)` — rôles `admin`, `team_leader`, `admissions`
- `updateMailTemplate(id, data)` — mêmes rôles
- `archiveMailTemplate(id)` — passe `active = false`, mêmes rôles
- `deleteMailTemplate(id)` — suppression définitive (`deletedAt = now()`), rôle `admin` uniquement, seulement si la trame est déjà archivée

**Permissions UI :**
- `direction` : drawer en lecture seule (pas de boutons Sauvegarder/Archiver/Supprimer)
- Bouton "Supprimer" visible uniquement pour `admin` sur une trame archivée

**Tiptap :** installer `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/extension-link`. Si des erreurs de bundling Next.js apparaissent, ajouter `@tiptap/react` aux `serverExternalPackages` dans `next.config.ts` (pattern déjà utilisé pour `pdf-lib`).

## Acceptance criteria

- [ ] Clic sur "Nouvelle trame" ouvre un drawer vide
- [ ] Clic sur une trame existante ouvre le drawer pré-rempli avec ses données
- [ ] L'éditeur Tiptap permet gras, italique, souligné, listes (à puces et numérotées), liens
- [ ] Le panneau "Variables" a un champ de recherche qui filtre la liste en temps réel
- [ ] Clic sur une variable l'insère à la position courante du curseur dans l'éditeur
- [ ] Chaque variable affiche son exemple entre parenthèses
- [ ] Le combobox "Catégorie" propose les valeurs existantes et accepte la saisie libre pour `admin` et `direction`
- [ ] "Sauvegarder" crée ou met à jour la trame et rafraîchit la liste
- [ ] "Archiver" passe `active = false` — la trame disparaît de la liste principale
- [ ] "Supprimer" (admin seulement, trame archivée) supprime définitivement la trame
- [ ] Un rôle non autorisé (ex: `direction`) voit le drawer en lecture seule
- [ ] Le HTML généré par Tiptap est correctement stocké dans `mailTemplates.body`

## Blocked by

- `.scratch/trames-mail/issues/01-liste-trames.md`

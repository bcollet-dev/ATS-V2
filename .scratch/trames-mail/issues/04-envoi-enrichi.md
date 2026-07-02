# 04 — Envoi enrichi : substitution de variables et injection signature

Status: ready-for-agent

## Parent

`.scratch/trames-mail/PRD.md`

## What to build

Connecter les trames et la signature au pipeline d'envoi d'email existant (`sendMatchingEmails` dans `/matching/actions.ts`) pour que les variables soient substituées et la signature injectée automatiquement.

**Fonction utilitaire `substituteVariables` :**

Créer une fonction partagée (dans `src/lib/mail-variables.ts` ou similaire) :

```ts
// Prototype — source de vérité pour la forme, pas à copier tel quel
function substituteVariables(
  html: string,
  context: Partial<Record<VariableKey, string>>
): string
```

- Remplace chaque occurrence de `{{variable}}` par la valeur du contexte
- Si la variable n'est pas dans le contexte : laisser `{{variable}}` intact (ne pas casser le template)
- Fonctionne sur du HTML (ne pas toucher aux balises)
- `VariableKey` = union des 19 noms de variables définis en issue 02

**Construction du contexte à l'envoi :**

Dans `sendMatchingEmails`, pour chaque email envoyé, construire le contexte à partir des données disponibles :

| Clé | Source |
|---|---|
| `prenom_candidat` | `candidates.firstName` |
| `nom_candidat` | `candidates.lastName` |
| `email_candidat` | `candidates.email` |
| `telephone_candidat` | `candidates.phone` |
| `cursus_candidat` | `candidates.cursusEnvisage` |
| `ville_candidat` | `candidates.city` |
| `titre_poste` | `needs.title` |
| `ville_poste` | `needs.city` |
| `date_debut` | `needs.startDate` |
| `date_fin` | `needs.endDate` |
| `type_contrat` | `needs.contractType` |
| `nom_entreprise` | `companies.name` |
| `ville_entreprise` | `companies.city` |
| `siret_entreprise` | `companies.siret` |
| `prenom_contact` | `companyContacts.firstName` du destinataire |
| `nom_contact` | `companyContacts.lastName` du destinataire |
| `prenom_consultant` | `profiles.fullName` (premier mot) de l'expéditeur |
| `nom_consultant` | `profiles.fullName` (dernier mot) de l'expéditeur |
| `nom_ecole` | Constante `"EDA Groupe"` |

**Injection signature :**

1. Charger `profiles.email_signature` de l'utilisateur courant (expéditeur).
2. Si elle existe : appender `<br><br><hr style="border:none;border-top:1px solid #eee;margin:16px 0"><br>` + la signature sanitisée à la fin du corps substitué.
3. Passer le résultat comme `html:` dans l'appel nodemailer.

**Mise à jour de `SendEmailModal` :**

Le sélecteur de trame existant dans `SendEmailModal` fonctionne déjà (sujet + corps pré-remplis depuis `loadEmailModalData`). Vérifier que le HTML Tiptap s'affiche correctement dans la textarea — si la textarea affiche du HTML brut, la remplacer par un `<div contenteditable>` ou conserver le textarea avec une note que le HTML sera bien envoyé.

## Acceptance criteria

- [ ] `substituteVariables` remplace correctement les 19 variables dans un corps HTML
- [ ] Une variable absente du contexte est laissée intacte (pas de crash, pas de `undefined`)
- [ ] À l'envoi depuis `SendEmailModal`, les variables `{{nom_candidat}}`, `{{titre_poste}}`, `{{nom_entreprise}}` sont bien remplacées par les vraies valeurs du matching
- [ ] La signature de l'expéditeur est ajoutée à la fin du corps dans chaque email envoyé
- [ ] Si l'expéditeur n'a pas de signature configurée, le corps est envoyé sans modification
- [ ] Un email envoyé depuis le matching avec une trame contenant des variables est bien personnalisé (vérifiable via le log d'activité ou l'historique Gmail)
- [ ] Le sélecteur de trame dans `SendEmailModal` continue de fonctionner (aucune régression)

## Blocked by

- `.scratch/trames-mail/issues/02-crud-trames.md`
- `.scratch/trames-mail/issues/03-signature-email.md`

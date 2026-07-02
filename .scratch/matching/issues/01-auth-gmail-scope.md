# 01 — Auth : scope Gmail & stockage du refresh token

Status: ready-for-agent

## Parent

`.scratch/matching/PRD.md`

## What to build

Étendre le flow Google OAuth existant pour demander la permission d'envoyer des emails via Gmail. Concrètement :

1. **Schéma DB** — ajouter une colonne `google_refresh_token text` nullable à la table `profiles`. Générer et appliquer la migration Drizzle.

2. **Route OAuth** — modifier la route `auth/google` pour passer les options suivantes à `signInWithOAuth` :
   - `scope` : ajouter `https://www.googleapis.com/auth/gmail.send` aux scopes existants
   - `access_type: "offline"` — pour recevoir un refresh token
   - `prompt: "consent"` — pour forcer la ré-émission du refresh token même si l'utilisateur a déjà consenti

3. **Callback OAuth** — dans `auth/callback`, après l'échange de code, extraire le `provider_refresh_token` depuis la session Supabase et le persister dans `profiles.google_refresh_token` via un UPDATE Drizzle (uniquement si la valeur est non nulle — l'email/password login ne fournit pas de refresh token).

Le refresh token stocké en base sera consommé par la Server Action d'envoi d'email (issue #06). Aucune UI n'est livrée dans cette issue.

## Acceptance criteria

- [ ] La colonne `google_refresh_token` existe sur la table `profiles` (migration appliquée)
- [ ] Le flow OAuth Google demande bien le scope `gmail.send` (vérifiable dans l'URL de redirection Google)
- [ ] Après un login Google réussi, `profiles.google_refresh_token` est renseigné en base pour l'utilisateur connecté
- [ ] Un login email/password n'écrase pas un refresh token existant (UPDATE conditionnel)
- [ ] Les utilisateurs sans refresh token (connexion email/password ou OAuth sans le scope) ont la colonne à NULL — pas d'erreur

## Blocked by

None — can start immediately

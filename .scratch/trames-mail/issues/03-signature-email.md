# 03 — Paramétrage : signature email par utilisateur

Status: ready-for-agent

## Parent

`.scratch/trames-mail/PRD.md`

## What to build

Permettre à chaque utilisateur de configurer sa propre signature email HTML, qui sera injectée automatiquement à la fin du corps lors de chaque envoi.

**Migration schema :**
Ajouter la colonne `email_signature text` (nullable) à la table `profiles`. Générer et appliquer la migration Drizzle (`db:generate` + `db:migrate`).

**Onglet "Paramétrage" de la page `/trames-mail` :**
- `<textarea>` pour coller du HTML brut (copié depuis Gmail, Outlook, etc.) — hauteur confortable (min 120px), police monospace pour que le HTML soit lisible
- Zone de prévisualisation en lecture seule (`<div dangerouslySetInnerHTML={{ __html: sanitizedHtml }}>`) qui se met à jour en temps réel au fur et à mesure de la saisie
- Bouton "Enregistrer la signature"
- La signature sauvegardée est rechargée au prochain chargement de la page

**Sanitisation XSS :**
Le HTML collé doit être sanitisé avant stockage et avant affichage. Utiliser `DOMPurify` côté client (dans le composant) pour nettoyer l'HTML avant l'envoi à la server action. La server action `saveEmailSignature` ne re-sanitise pas (on fait confiance au client ici car c'est une donnée propre à l'utilisateur), mais on s'assure que la colonne est bien `text` (pas d'exécution).

**Server actions :**
- `saveEmailSignature(html: string)` — met à jour `profiles.email_signature` pour `requireAuth().id`
- `loadEmailSignature()` — retourne `profiles.email_signature` pour l'utilisateur courant (appelée depuis le Server Component de la page)

**Chargement initial :**
Le Server Component de `/trames-mail` charge la signature de l'utilisateur courant et la passe au Client Component de l'onglet Paramétrage.

## Acceptance criteria

- [ ] La migration `email_signature` est appliquée — la colonne existe sur `profiles`
- [ ] L'onglet "Paramétrage" est accessible depuis la page `/trames-mail`
- [ ] La textarea permet de coller du HTML
- [ ] La prévisualisation se met à jour en temps réel
- [ ] "Enregistrer" sauvegarde la signature et affiche un toast de confirmation
- [ ] La signature sauvegardée est pré-chargée à la prochaine ouverture de la page
- [ ] Un HTML malveillant (balise `<script>`, handler `onerror`) est nettoyé avant stockage via DOMPurify
- [ ] Un utilisateur ne peut modifier que sa propre signature (la server action utilise l'id de session, pas un id passé en paramètre)

## Blocked by

- `.scratch/trames-mail/issues/01-liste-trames.md`

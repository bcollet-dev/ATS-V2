# 01 — Page trames-mail : liste et filtres

Status: ready-for-agent

## Parent

`.scratch/trames-mail/PRD.md`

## What to build

Créer la route `/trames-mail` qui affiche la bibliothèque centrale de trames email. C'est la fondation sur laquelle les autres issues s'appuient.

La page est un Server Component qui charge toutes les trames depuis `mailTemplates` et les passe à un Client Component. L'UI affiche une liste de cartes (nom, catégorie, audience, auteur, date de modification) avec des filtres côté client pour catégorie, audience et état (actif / archivé). Par défaut seules les trames actives sont affichées ; un toggle permet de voir les archivées.

La page a une structure en **deux onglets** ("Trames" et "Paramétrage") car l'issue 03 viendra brancher le second onglet — prévoir le conteneur dès maintenant avec le second onglet vide ou désactivé.

Un bouton "Nouvelle trame" est visible pour les rôles `admin`, `team_leader`, `admissions` — il n'est pas encore fonctionnel (sera câblé en issue 02).

La server action `listMailTemplates({ includeArchived?: boolean })` interroge `mailTemplates` avec jointure sur `profiles` pour l'auteur, filtre `deletedAt IS NULL`, et trie par nom.

## Acceptance criteria

- [ ] La route `/trames-mail` existe et est accessible depuis la nav (lien "Trames mail" déjà présent dans `nav-items.ts`)
- [ ] La liste affiche toutes les trames actives avec : nom, catégorie (badge), audience (badge), nom de l'auteur, date de dernière modification
- [ ] Le filtre "catégorie" réduit la liste aux trames de la catégorie choisie
- [ ] Le filtre "audience" (`candidate`, `company`, `need`, `all`) fonctionne
- [ ] Un toggle ou filtre "Voir les archivées" affiche les trames avec `active = false`
- [ ] Le bouton "Nouvelle trame" est visible pour `admin`, `team_leader`, `admissions` ; absent pour `direction` et les autres rôles
- [ ] La structure en deux onglets "Trames" / "Paramétrage" est en place (le second onglet peut être vide)
- [ ] Les trames créées depuis `SendEmailModal` (matching) apparaissent dans la liste

## Blocked by

None — can start immediately.

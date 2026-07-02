# 01 — Désignation d'une trame "notification CV par défaut"

Status: ready-for-agent

## Parent

`.scratch/notif-candidat-cv/PRD.md`

## What to build

Permettre à un administrateur de désigner une trame mail existante comme "notification CV par défaut". Cette trame sera automatiquement utilisée lors des envois de CVs via le matching pour notifier les candidats.

La feature couvre toute la chaîne : migration DB → actions serveur → UI dans `/trames-mail`.

**Schéma :**
Ajouter un champ booléen `is_default_cv_notification` (défaut `false`) sur la table `mail_templates`. Un seul enregistrement peut avoir ce flag à `true` à la fois : l'exclusivité est gérée côté applicatif via une transaction qui remet le flag à `false` sur toutes les autres trames avant de l'activer sur la cible.

**Actions serveur :**
- `setDefaultCvNotification(id)` : transaction exclusive, revalidate `/trames-mail`
- `loadDefaultCvNotificationTemplate()` : retourne la trame marquée par défaut ou `null`
- `listMailTemplates` : inclure `isDefaultCvNotification` dans les données retournées

**UI `/trames-mail` :**
- Dans le drawer d'édition d'une trame (rôles canEdit uniquement) : toggle ou bouton "Utiliser comme notification CV par défaut". Si la trame est déjà désignée, afficher l'état actif avec possibilité de retirer la désignation.
- Dans la liste des trames : badge distinctif sur la trame désignée (ex. "Notif. CV par défaut").

## Acceptance criteria

- [ ] La colonne `is_default_cv_notification` existe sur `mail_templates` en base et dans le schéma Drizzle
- [ ] Cliquer sur le toggle dans le drawer désigne la trame → une seule trame a le flag à `true` après l'opération
- [ ] Si une autre trame était déjà désignée, son flag repasse à `false` automatiquement
- [ ] La trame désignée affiche un badge dans la liste `/trames-mail`
- [ ] Le toggle n'est visible que pour les rôles canEdit (admin, team_leader, admissions)
- [ ] `loadDefaultCvNotificationTemplate()` retourne la trame active ou `null` si aucune n'est désignée
- [ ] La direction ne voit pas le toggle (rôle exclu des fonctions système)

## Blocked by

None — can start immediately.

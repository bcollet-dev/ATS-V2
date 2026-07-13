# Guide — Utilisateurs, invitations & rôles

## À quoi ça sert

Contrôler **qui accède à l'ATS** et **avec quels droits** : inviter de nouveaux
utilisateurs, définir leur rôle, réactiver un ancien collègue, et prévisualiser
l'appli telle qu'un rôle la voit. Réservé aux **administrateurs**.

## Comment on entre dans l'ATS (le principe)

L'accès est **doublement verrouillé**, côté serveur :
1. l'email doit être en **`@eda-rh.fr`** ;
2. l'email doit avoir reçu une **invitation** (non déjà utilisée).

À la première connexion Google, le compte est créé automatiquement avec le **rôle
défini dans l'invitation**. Sans invitation valide, la connexion est refusée.

## Inviter un utilisateur

**Paramètres → Invitations** → saisir l'email (`@eda-rh.fr`) + choisir le rôle → **Inviter**.

**Ce que ça entraîne :**
- L'email est autorisé à créer son compte, avec le rôle choisi.
- Tant que la personne ne s'est pas connectée, l'invitation est « en attente » et
  peut être **supprimée**. Une fois utilisée, elle est marquée « consommée ».

## Les rôles

| Rôle | En bref |
|------|---------|
| **Admin** | Tous les droits, y compris gestion des utilisateurs et invitations. |
| **Direction** | Pilotage global, édition candidats/besoins/matchings. |
| **Team Leader** | Encadrement d'équipe, édition candidats/besoins/matchings. |
| **Recruteur** (admissions) | Gestion candidats et admissions. |
| **Relation entreprise** | Gestion entreprises, besoins, envoi de CV. |

## Gérer un utilisateur existant

**Paramètres → Utilisateurs** — pour chaque utilisateur (sauf vous-même) :

| Action | Ce que ça entraîne |
|--------|--------------------|
| **Changer le rôle** | Met à jour immédiatement les droits de la personne. |
| **Désactiver** | La personne ne peut plus accéder à l'ATS (compte conservé). |
| **Réactiver** | Redonne l'accès à un utilisateur désactivé. |

- 🔒 Vous **ne pouvez pas** modifier votre **propre** rôle ni vous désactiver
  vous-même (protection contre l'auto-verrouillage).
- Réactiver un ancien collègue se fait ici, en un clic — pas besoin de repasser
  par une invitation.

## Prévisualiser un rôle / un utilisateur

Boutons **« Prévisualiser »** / **« Voir comme »** : l'admin voit l'interface telle
qu'elle apparaît pour ce rôle ou cette personne.

**Ce que ça entraîne :**
- C'est un mode **observation** : les actions de modification y sont bloquées.
- Un bandeau indique que vous êtes en prévisualisation ; **Quitter** revient à votre
  vue normale. Le mode s'arrête aussi à la fermeture du navigateur.

## Points d'attention

- Gardez toujours **au moins un admin actif** : vous ne pouvez pas retirer vos
  propres droits, ce qui évite de bloquer tout le monde.
- L'accès est réservé aux emails `@eda-rh.fr` invités — inviter une adresse hors
  domaine est refusé.

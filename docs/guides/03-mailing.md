# Guide — Mailing & trames mail

## À quoi ça sert

Envoyer des emails depuis l'ATS avec **votre propre boîte Gmail** : messages
individuels depuis une fiche (candidat, entreprise, besoin), et **envoi de CV aux
entreprises** depuis le matching. Les trames (modèles) et votre signature évitent
de tout retaper.

## Connecter Gmail (une fois)

1. **Trames mail** → **Connecter Gmail** → choisissez votre compte Google et
   autorisez l'envoi.
2. C'est terminé : l'ATS peut envoyer **en votre nom**.

**Ce que ça entraîne :**
- L'ATS reçoit un jeton d'accès **chiffré**, stocké côté serveur — il n'est jamais
  visible dans votre navigateur.
- Les emails partent depuis **votre adresse** ; les destinataires vous répondent
  directement.
- Si le lien Gmail expire ou est révoqué (changement de mot de passe, inactivité),
  l'envoi affichera « reconnectez Gmail » : refaites simplement l'étape 1.

## Trames (modèles) et signature

- **Trames mail** : créez / modifiez / archivez des modèles (objet + corps) avec
  des **variables** `{{prenom_candidat}}`, `{{nom_entreprise}}`, `{{titre_poste}}`…
  remplacées automatiquement à l'envoi.
- **Signature** : renseignez poste, téléphone, entité, réseaux → elle s'ajoute
  automatiquement en bas de vos emails.
- Une trame peut être marquée **« notification CV par défaut »** : c'est le message
  envoyé aux candidats quand vous transmettez leur CV (voir plus bas).

## Envoyer un email depuis une fiche

1. Fiche candidat / entreprise / besoin → **Envoyer un email**.
2. Choisissez le destinataire, une trame (optionnel), ajoutez des pièces jointes
   depuis la fiche, puis **Envoyer**.

**Ce que ça entraîne :**
- Les variables sont remplies, votre signature ajoutée, l'email part depuis votre Gmail.
- L'envoi est **tracé dans l'historique** de la fiche (destinataire, objet, pièces jointes).
- En cas d'échec (Gmail déconnecté, pièce introuvable), un message vous l'indique
  et **rien n'est envoyé**.

## Envoyer des CV aux entreprises (matching)

Depuis le matching, sélectionnez les besoins et **Envoyer les CV**.

| Point | Comportement |
|-------|--------------|
| **Qui peut le faire** | Rôles habilités uniquement (admin, direction, team_leader, admissions, relations entreprises). |
| **Anti-doublon** | Un même CV n'est **pas renvoyé** au même contact pour le même besoin s'il est parti il y a **moins de 2 minutes** (protège du double-clic). |
| **Notifier les candidats** | Si coché, chaque candidat dont le CV part reçoit la trame « notification CV ». |
| **Résultat** | Un récapitulatif indique, besoin par besoin, ce qui est **envoyé** ou **en échec** (avec le motif). |
| **Taille de lot** | Maximum **50 envois** en une fois ; au-delà, procédez en plusieurs lots. |

**Ce que ça entraîne :**
- Chaque envoi entreprise est **tracé dans l'historique** du besoin.
- Un envoi en échec n'interrompt pas les autres : seuls les envois réussis comptent.
- Si des **notifications candidats** échouent, un avertissement vous l'indique
  (le reste part quand même).

## Points d'attention

- Vous envoyez **en votre nom** : vérifiez le destinataire et les pièces jointes
  avant d'envoyer, surtout pour les CV aux entreprises.
- Les variables non reconnues restent telles quelles (`{{...}}`) — relisez l'aperçu.
- La connexion Gmail est **personnelle** : chacun connecte la sienne.

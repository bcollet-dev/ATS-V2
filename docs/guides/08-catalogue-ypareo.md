# Guide — Catalogue Ypareo & promos

## À quoi ça sert

Garder le référentiel des **cursus** et **promos (actions de formation)** aligné
avec Ypareo, et **empêcher les recruteurs de placer des candidats sur des promos
terminées** — tout en gardant l'historique.

## Synchroniser le catalogue

**Cursus** → **Synchroniser**. Réservé aux rôles **Admin / Direction**.

**Ce que ça entraîne :**
- Les cursus et promos d'Ypareo sont créés/mis à jour dans l'ATS.
- Vos réglages **locaux** (ex. webhook Slack d'une promo) sont **préservés**.
- Les promos qui ont **disparu d'Ypareo** (supprimées côté Ypareo) sont
  automatiquement **désactivées** (jamais supprimées — l'historique est conservé).
  Sécurité : si Ypareo renvoie un catalogue vide (incident), **rien n'est
  désactivé**.
- Un item qui échoue n'interrompt pas la synchro ; le nombre d'échecs est signalé.

## Promo « en cours » vs « terminée »

Une promo est **plaçable** jusqu'à **3 mois et 1 jour après sa date de début**.
Au-delà, elle est **terminée** :
- elle **n'apparaît plus** dans le choix de classe lors d'un placement ;
- l'**envoi Ypareo est bloqué** si on tente quand même de placer dessus.

C'est automatique, basé sur la date de début — aucune action manuelle.

## Année scolaire & désencombrement

Chaque promo affiche son **année scolaire** (ex. `26-27`), déduite de sa date de
début (sept→août). Dans l'onglet Cursus, la case **« Masquer les promos terminées »**
(cochée par défaut) garde la vue propre ; décochez-la pour revoir l'historique des
promos passées (badge **Terminée**).

## Points d'attention

- Une promo sans date de début reste plaçable (on ne peut pas la dater) — vérifiez
  ses dates côté Ypareo si besoin.
- « Terminée » n'efface rien : la promo reste consultable et les placements passés
  qui la référencent sont intacts.

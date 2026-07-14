# Guide — Annuaire (entreprises & contacts)

## À quoi ça sert

Retrouver rapidement un candidat, un contact ou une entreprise, et gérer les
fiches entreprises (infos légales, contacts, alternants, documents).

## Rechercher

Barre de recherche → filtrez par **Candidat / Contact / Entreprise**. La recherche
porte sur le nom, l'email, le téléphone, le SIRET, la ville…

**Ce que ça entraîne :** seules les fiches **non supprimées** remontent ; la
recherche est réservée aux utilisateurs connectés.

## Créer une entreprise (avec SIRET)

Saisissez le **SIRET** : l'ATS interroge le registre officiel
(recherche-entreprises.api.gouv.fr) et **préremplit** raison sociale, adresse,
code NAF, forme juridique, effectif, statut administratif.

**Ce que ça entraîne :** un SIRET déjà présent est **bloqué** (pas de doublon) ;
sinon la fiche est créée avec votre identité comme auteur.

## Gérer une fiche entreprise

| Action | Qui | Effet |
|--------|-----|-------|
| Modifier infos / FRE / responsable | admin, direction, team_leader, relation entreprise | Met à jour la fiche. |
| Resynchroniser depuis le registre (SIRET) | idem | Recharge les données officielles. |
| Ajouter / modifier / supprimer un contact | idem | Gère les interlocuteurs RH. |
| Archiver l'entreprise | admin, direction | Retire la fiche des vues actives (récupérable). |

Les actions de modification sont **bloquées en mode prévisualisation** (« voir
comme ») pour ne rien écrire au nom d'un autre utilisateur.

## Points d'attention

- Un **SIRET** identifie l'entreprise de façon unique : réutilisez la fiche
  existante plutôt que d'en créer une seconde.
- L'archivage n'efface rien : la fiche et son historique restent récupérables ;
  la suppression définitive relève de la purge RGPD.

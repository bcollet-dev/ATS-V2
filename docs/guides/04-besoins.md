# Guide — Besoins

## À quoi ça sert

Suivre les besoins de recrutement des entreprises (postes en alternance) : les
créer, leur associer un cursus, les faire avancer dans le pipeline, et les archiver
quand ils aboutissent ou tombent à l'eau.

## Qui peut faire quoi

| Action | Rôles autorisés |
|--------|-----------------|
| Créer / modifier un besoin, changer statut, cursus, owner, ville, contrat | admin, direction, team_leader, relations entreprises (`needs:edit`) |
| Supprimer définitivement | admin, direction (`needs:delete`) |

Une action sans le bon rôle est refusée et **rien n'est modifié**.

## Créer un besoin

1. **Besoins** → **Nouveau besoin** → entreprise, intitulé, cursus cible, ville,
   nombre de postes, responsable, et une **tâche premier-contact**.
2. **Créer.**

**Ce que ça entraîne :**
- Le besoin est créé au statut initial, avec votre identité comme créateur (traçabilité).
- Une tâche de premier contact est créée et rattachée à l'entreprise ; si elle est
  assignée à quelqu'un d'autre, cette personne est notifiée.

## Faire avancer un besoin (pipeline)

Glissez la carte du besoin d'une colonne à l'autre. Le statut d'un besoin reflète
l'avancement de ses candidats (matchings) : proposition de CV, entretien entreprise,
attente FRE, placement…

**Ce que chaque étape entraîne :**
- **Entretien / Attente FRE / Retenu** : synchronise le statut du/des candidat(s)
  concerné(s) et du besoin. Si plusieurs candidats sont éligibles, une fenêtre vous
  demande lesquels.
- **Client (Ypareo)** : déclenche le rattachement Ypareo (voir guide Ypareo).
- **Rupture** : pour un candidat **placé** — passe par le contrôle du contrat Ypareo
  et la procédure de rupture.

## Archiver un besoin (« Perdu »)

Glissez le besoin vers **Perdu** puis indiquez un **motif**.

**Ce que ça entraîne :**
- Le besoin passe en archivé ; ses candidats **encore en lice** (non engagés) sont
  retirés de ce besoin (matchings « non retenus ») et leurs statuts resynchronisés.
- 🚫 **Blocage de sécurité** : si un candidat est **placé** (ou en rupture) sur ce
  besoin, l'archivage est **refusé**. Un besoin avec un apprenti placé n'est pas
  « perdu » : gérez d'abord la **rupture** (qui traite le contrat Ypareo). Cela
  évite de « dé-placer » un apprenti contractualisé par erreur.

## Supprimer définitivement

Réservé à admin/direction, et **uniquement après archivage** (statut « Perdu »).
La suppression retire le besoin et ses données liées.

## Points d'attention

- L'archivage ne casse jamais un placement : tant qu'un candidat est placé, gérez
  la rupture avant.
- Le statut d'un besoin suit ses candidats : évitez de le forcer manuellement si un
  matching le fait déjà évoluer.
- Un besoin peut cibler **plusieurs cursus** (bloc Cursus de la fiche).

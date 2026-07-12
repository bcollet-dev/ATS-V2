# Guide — Candidats & documents

## À quoi ça sert

Faire entrer un candidat dans l'ATS, rassembler ses pièces (CV, CNI, carte
vitale, diplômes), laisser l'IA pré-remplir sa fiche, puis le faire avancer dans
le pipeline jusqu'à l'entretien EDA.

## Qui peut faire quoi

| Action | Rôles autorisés |
|--------|-----------------|
| Créer un candidat / une entreprise | admin, direction, team_leader, admissions (candidat) · admin, direction, team_leader, relations entreprises (entreprise) |
| Importer / supprimer un document | tout utilisateur ayant accès à la fiche |
| Appliquer les données extraites (hors NIR) | idem |
| Appliquer le **NIR** | admin, admissions uniquement |
| Faire avancer le statut (amont) | admin, direction, team_leader, admissions |

Un utilisateur sans le bon rôle reçoit un message d'erreur et **rien n'est créé**.

## Créer un candidat

1. Annuaire → **Nouveau candidat** → nom, prénom, téléphone, email, cursus envisagé.
2. Contrôles automatiques :
   - **Email déjà utilisé** → création bloquée (un email = un seul candidat actif).
   - **Nom/prénom proches d'un candidat existant** → avertissement listant les
     doublons potentiels ; vous pouvez confirmer si c'est bien une autre personne.

**Ce que ça entraîne :** le candidat est créé au statut **« À appeler »**, avec
votre identité enregistrée comme créateur (traçabilité). Aucune tâche n'est créée
automatiquement — pensez à vous assigner une tâche d'appel si besoin.

## Importer un document et l'extraction IA

1. Fiche candidat → bloc **Documents** → choisissez le type (CV, CNI, carte
   vitale, diplôme, autre) et déposez le fichier (PDF, Word ou image, max 20 Mo).
2. Pour CV / CNI / carte vitale, **un seul document par type** : réimporter
   **remplace** l'ancien (l'ancien fichier est supprimé). Les diplômes et « autres »
   peuvent être multiples.
3. Si l'extraction IA est activée, elle démarre automatiquement (sauf type « autre »).

**Ce que ça entraîne :**
- Le fichier est stocké de façon sécurisée ; l'accès passe par un lien signé
  temporaire (1 h).
- L'IA lit le document et propose des informations (coordonnées, expériences,
  formations, compétences, état civil, NIR pour la carte vitale).
- Statut d'extraction : **en cours** → **terminée** ou **échouée**. En cas
  d'échec, un bouton **Réessayer** relance l'analyse.
- Le **NIR** est immédiatement chiffré et **jamais transmis à votre navigateur** :
  vous ne voyez qu'une version masquée.

## Vérifier et appliquer l'extraction

1. Ouvrez la revue d'extraction : cochez uniquement les champs à reprendre.
2. **Appliquer.**

**Ce que ça entraîne :**
- Les champs cochés écrivent la fiche candidat. Les doublons sont évités
  (compétences par nom, expériences/formations par intitulé + structure + date).
- Le NIR n'est écrit que si vous êtes admin/admissions.
- ⚠️ Astuce : appliquez la revue **sans relancer** l'extraction entre-temps —
  si vous cliquez « Réessayer » puis « Appliquer » sur une ancienne revue, les
  éléments cochés peuvent ne plus correspondre. En cas de doute, rouvrez la revue.

## Faire avancer le candidat (pipeline amont)

Glissez la carte d'une colonne à l'autre (À appeler → En cours → Sans réponse →
Entretien…), ou changez le statut depuis la fiche.

**Ce que ça entraîne selon la destination :**
- **Refus temporaire / définitif** → demande le motif, applique le refus au
  candidat et **retire ses matchings** en cours (les besoins liés sont resynchronisés).
- **Entretien** → ouvre la fenêtre de **planification** (voir ci-dessous).

## Planifier l'entretien EDA

Quand un candidat passe en **Entretien**, une fenêtre demande : **date/heure**,
**visio ou présentiel**, et **qui** réalise l'entretien (vous par défaut, modifiable).

- **Planifier** → crée une tâche d'entretien datée, assignée, visible dans le
  widget **Mes tâches** ; l'assigné est notifié si ce n'est pas vous.
- **Passer** (ou fermer la fenêtre) → crée quand même une tâche **« Entretien à
  planifier »** pour vous, afin que le candidat ne reste jamais oublié sans tâche.

## Points d'attention

- Un candidat **en entretien n'a pas encore de besoin** (le matching vient
  après l'admissibilité) — c'est normal.
- Réimporter un CV **écrase** le précédent : gardez l'original hors ATS si besoin.
- Le NIR est une donnée sensible : il reste chiffré, masqué à l'écran, et n'est
  jamais envoyé au navigateur ni journalisé.

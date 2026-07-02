# 06 — BlocHistorique

Status: done

## What to build

Ajouter un fil d'activité chronologique en bas de la colonne principale, affichant tous les événements survenus sur le besoin.

**BlocHistorique :** Server Component requêtant `activityEvents WHERE needId = :id ORDER BY createdAt DESC` avec jointure sur `profiles` pour afficher le nom de l'auteur. Rendu en liste chronologique inversée.

Chaque entrée affiche :
- Une icône selon `actionType` (statut modifié → flèche, champ modifié → crayon, candidat ajouté → personne, tâche → checkbox, FRE → document)
- Le champ `summary` tel quel
- Le nom de l'auteur (`profiles.firstName + lastName`)
- La date relative (ex. "il y a 2 heures", "hier") avec la date absolue au survol

**ActionTypes supportés à ce stade :** `need_status_changed`, `need_fields_updated`, `need_cursus_updated`, `matching_added`, `matching_removed`, `matching_status_changed`, `task_created`, `task_completed`, `fre_generated`, `fre_imported`, `fre_fields_applied`. Les événements non reconnus sont affichés avec une icône générique et leur `summary` brut.

Le bloc est vide (avec message "Aucune activité pour l'instant") si aucun événement n'existe — ce qui est le cas pour les besoins existants avant déploiement de cette tranche.

## Acceptance criteria

- [ ] `BlocHistorique` affiche les événements du besoin en ordre chronologique inversé
- [ ] Chaque entrée montre l'icône appropriée, le summary, l'auteur et la date relative
- [ ] La date absolue s'affiche au survol de la date relative
- [ ] Le bloc affiche un message vide si aucun événement n'existe
- [ ] Le composant est un Server Component (pas de `"use client"`)
- [ ] `npx tsc --noEmit` passe sans nouvelles erreurs

## Blocked by

- `.scratch/fiche-besoin/issues/02-layout-cerfa-drawer.md`

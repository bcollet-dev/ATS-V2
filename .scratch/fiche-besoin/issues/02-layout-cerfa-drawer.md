# 02 — Layout fiche + CERFA drawer

Status: done

## What to build

Restructurer la page `/besoins/[id]` en une mise en page à deux colonnes (colonne principale ≈2/3, sidebar ≈1/3) et implémenter le drawer d'édition des champs CERFA FA13.

**Layout :** L'en-tête existant (titre, nom entreprise, badge statut, méta) est conservé tel quel. Sous l'en-tête, la page se divise en deux colonnes. La colonne principale accueille, dans l'ordre : un bouton "Modifier les informations du contrat" (ouvre le drawer), puis les slots pour les futures tranches (cursus, propositions, tâches, historique). La sidebar accueille le slot pour les futures tranches (entreprise + FRE). Les slots sont des placeholders vides pour l'instant.

**NeedContractDrawer :** Composant client avec quatre sections :
1. Informations du poste : durée hebdomadaire (`weeklyHours`), type de contrat (`contractType`), référence de salaire (`salaryReference`), montant SMC si applicable (`smcAmount`), gestion des heures sup (`overtimeHandling`), date de fin (`endDate`)
2. Maître d'apprentissage : prénom, nom, date de naissance, fonction, téléphone, email (6 champs de `masterXxx`)
3. Avantages en nature : repas (`benefitFood`), logement (`benefitHousing`), autres (`benefitOther`)
4. (La date de début `startDate` est déjà sur la fiche — pas à dupliquer)

Le drawer affiche en lecture seule les valeurs actuelles et passe en mode édition au clic sur "Modifier".

**Server action `updateNeedContractFields(needId, fields)` :** Valide les champs, met à jour `needs` en base, appelle `logActivityEvent`.

**Utilitaire `logActivityEvent({ needId, actorId, actionType, summary, metadata })` :** Fonction serveur réutilisable qui insère une ligne dans `activityEvents`. Sera réutilisée par toutes les tranches suivantes.

À la sauvegarde du drawer, un événement `need_fields_updated` est loggé avec un summary listant les champs modifiés.

La fiche est accessible en lecture seule pour le rôle `direction` (les boutons d'édition sont masqués).

## Acceptance criteria

- [ ] La page `/besoins/[id]` affiche la mise en page 2 colonnes sans régression sur l'en-tête existant
- [ ] Le bouton "Modifier les informations du contrat" ouvre le drawer
- [ ] Le drawer affiche les 15 champs CERFA organisés en sections
- [ ] La sauvegarde met à jour les champs en base et ferme le drawer
- [ ] Un événement `need_fields_updated` apparaît dans `activity_events` après sauvegarde (vérifiable en DB)
- [ ] L'utilitaire `logActivityEvent` est exporté et utilisable depuis d'autres server actions
- [ ] Le rôle `direction` voit la fiche mais les boutons d'édition sont masqués
- [ ] `npx tsc --noEmit` passe sans nouvelles erreurs

## Blocked by

- `.scratch/fiche-besoin/issues/01-migrations-schema.md`

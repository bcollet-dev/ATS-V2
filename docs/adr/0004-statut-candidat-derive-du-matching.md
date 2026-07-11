# Le statut pipeline du candidat (et du besoin) est dérivé automatiquement du matching le plus avancé

À partir du statut "Admissible", le statut principal d'un candidat dans son pipeline n'est pas saisi manuellement — il est calculé automatiquement comme le statut de proposition le plus avancé parmi tous ses matchings actifs. Même logique côté besoin. Quand un statut de proposition change sur un matching, les deux pipelines (candidat et besoin) se recalculent.

Ce choix garantit que le pipeline reflète toujours la réalité opérationnelle sans action manuelle supplémentaire du recruteur, et élimine les incohérences entre l'état d'un matching et l'état affiché sur la fiche candidat.

## Correspondance statuts de proposition → pipeline

| Statut de proposition (Matching) | Statut candidat dérivé | Statut besoin dérivé |
|---|---|---|
| CV envoyé | Admissible | Besoin en cours |
| Entretien | Entretien entreprise | Entretien |
| Attente FRE | Attente FRE | Placé attente FRE |
| Placé | Placé | Client |
| Tous non retenus | Admissible (repli) | Besoin en cours (repli) |

## Consequences

Les statuts pré-matching du pipeline candidat (A appeler, En cours, NRP, Entretien, PVPP, Admissible) restent manuels. Les statuts Refus temporaire, Refus définitif et Rupture restent manuels sur le candidat. Rupture reste manuel sur le besoin.

Règle de repli : si tous les matchings d'un candidat passent en "Non retenu", le candidat retourne automatiquement en "Admissible". Si tous les matchings d'un besoin passent en "Non retenu", le besoin retourne automatiquement en "Besoin en cours".

## Amendement 2026-07-11 — transitions pré-matching médiées par le flux d'entretien

Les statuts pré-matching restent des décisions du recruteur, mais trois transitions sont désormais médiées par le flux d'entretien de positionnement plutôt que déplacées à la main dans le pipeline : « Candidat non présent » sur une tâche d'entretien passe le candidat en PVPP (uniquement s'il est au statut Entretien EDA), et la finalisation d'un entretien de positionnement applique Admissible ou Refus temporaire/définitif avec motif. La modification a posteriori de la décision d'un entretien ne change le statut que sur confirmation explicite du recruteur. La dérivation automatique post-Admissible par les matchings est inchangée.

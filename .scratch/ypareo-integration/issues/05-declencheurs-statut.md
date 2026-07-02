# 05 — Déclencheurs statut besoin + candidat

Status: ready-for-agent

## Parent

`.scratch/ypareo-integration/PRD.md`

## What to build

Brancher `YpareoPlacementModal` sur les deux points de déclenchement dans l'app.

**Point 1 — Fiche besoin, passage vers "Client" :**
- Dans le composant de changement de statut du besoin, intercepter le passage vers `client`
- Avant de confirmer le changement de statut, ouvrir `YpareoPlacementModal`
- Si l'utilisateur ferme la modale sans envoyer → le statut ne change pas
- Si l'utilisateur envoie (succès ou annulation consciente) → le statut passe à `client`

**Point 2 — Fiche candidat, passage vers "Placé" (`placed`) :**
- Même logique : intercepter le passage vers `placed`
- Ouvrir `YpareoPlacementModal` — `needId` est le besoin actuellement associé au candidat (le matching winner)
- Si aucun besoin winner associé → afficher un message d'erreur et ne pas ouvrir la modale

## Acceptance criteria

- [ ] Sur la fiche besoin, passer au statut "Client" ouvre la modale Ypareo avant de valider
- [ ] Si la modale est fermée sans envoi, le statut besoin ne change pas
- [ ] Sur la fiche candidat, passer au statut "Placé" ouvre la modale Ypareo
- [ ] Si aucun besoin winner n'est associé, un message explicite est affiché (pas de crash)
- [ ] Après envoi Ypareo réussi, le statut change normalement

## Blocked by

- `04-modal-push-placement.md`

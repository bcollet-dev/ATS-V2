# 06 — Indicateur fiche candidat + logs admin `/erreurs`

Status: ready-for-agent

## Parent

`.scratch/ypareo-integration/PRD.md`

## What to build

Visibilité post-envoi : badge sur la fiche candidat et table de logs dans la section admin.

**Badge fiche candidat :**
- Si `candidate.ypareoPersonId` est renseigné OU si un `ypareoLog` avec `status: "success"` existe pour ce `candidateId` → afficher un badge "Envoyé sur Ypareo" avec la date du dernier envoi réussi
- Positionné dans la fiche candidat, section statut ou en-tête

**Section logs dans `/erreurs` :**
- Onglet ou section "Logs Ypareo" dans la page admin `/erreurs`
- Table paginée des `ypareoLogs` : date, candidat (lien), statut (success/error/pending), endpoint, message d'erreur si applicable
- Accessible uniquement aux rôles `admin` et `admissions` — `direction` exclue (cohérent avec `adminNavItems` et la contrainte de périmètre direction)
- Cliquer sur une ligne → afficher le détail (requestPayload masqué + responsePayload) dans un panneau latéral ou modal

## Acceptance criteria

- [ ] Badge "Envoyé sur Ypareo" visible sur la fiche candidat après un push réussi
- [ ] Le badge affiche la date du dernier envoi réussi
- [ ] La section logs Ypareo est visible dans `/erreurs` pour admin et admissions
- [ ] La section est absente (ou retourne 403) pour le rôle `direction`
- [ ] Les logs affichent statut, date, candidat lié, et message d'erreur si applicable
- [ ] Le détail d'un log ne contient pas de NIR en clair (`[MASKED]` visible à la place)

## Blocked by

- `04-modal-push-placement.md`

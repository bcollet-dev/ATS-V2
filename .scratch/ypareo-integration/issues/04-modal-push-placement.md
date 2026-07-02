# 04 — Modale placement Ypareo + Server Action push

Status: done

## Parent

`.scratch/ypareo-integration/PRD.md`

## What to build

Composant `YpareoPlacementModal` et Server Action `pushYpareoPlacement()` — le cœur de l'intégration.

**Composant `YpareoPlacementModal` (`src/components/ypareo/YpareoPlacementModal.tsx`) :**
- Reçoit en props : `candidateId`, `needId`, `open`, `onOpenChange`, `onSuccess`
- Charge les données complètes (candidat, entreprise, maître d'apprentissage, contrat) pour affichage
- Affiche les données en 4 sections : Candidat / Entreprise / Maître d'apprentissage / Contrat
- Détecte les champs manquants par section — affiche un bandeau d'avertissement listé
- Si champs manquants : checkbox "Je confirme envoyer malgré les données incomplètes" obligatoire avant de valider
- Picker cursus → picker classe (filtré par cursus sélectionné, pré-sélectionné si `candidate.cursusId` renseigné)
- Bouton "Envoyer sur Ypareo" → appelle `pushYpareoPlacement()`

**Server Action `pushYpareoPlacement(candidateId, needId, cursusExternalId, classeExternalId)` :**
- Charge toutes les données depuis la DB
- Construit le payload monolithique Ypareo (candidat + entreprise + maître d'apprentissage + contrat + cursus + classe)
- **Masque le NIR** : remplace `nirEncrypted` par `"[MASKED]"` dans le payload stocké en log
- Insère un `ypareoLog` avec `status: "pending"`
- Appelle `pushPlacementToYpareo(payload)`
- Met à jour le log : `status: "success"` + `responsePayload`, ou `status: "error"` + `errorMessage`
- En succès : met à jour `candidate.ypareoPersonId` si retourné par Ypareo

**Types de payload Ypareo :**
Même structure que V1 — adapter depuis `C:\ATS_V1\apps\ats\src\app\candidates\actions.ts`.

## Acceptance criteria

- [ ] La modale s'ouvre et affiche les données des 4 sections
- [ ] Les champs manquants sont correctement identifiés et listés par section
- [ ] La checkbox de confirmation est obligatoire quand des champs manquent — le bouton Envoyer reste désactivé tant qu'elle n'est pas cochée
- [ ] Le picker cursus/classe fonctionne, la classe est filtrée par cursus sélectionné
- [ ] Le NIR n'apparaît jamais dans `ypareoLogs.requestPayload` (masqué avant stockage)
- [ ] Un `ypareoLog` est créé pour chaque tentative, avec `status` final correct
- [ ] En cas de succès, `candidate.ypareoPersonId` est mis à jour si la réponse Ypareo le fournit
- [ ] En cas d'erreur Ypareo, un toast d'erreur s'affiche et le log est marqué `error`

## Blocked by

- `01-db-migrations-forms.md`
- `02-ypareo-client-lib.md`

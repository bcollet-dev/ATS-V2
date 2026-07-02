# 04 — Multi-select, bandeau flottant et création de matchings en lot

Status: ready-for-agent

## Parent

`.scratch/matching/PRD.md`

## What to build

Permettre la sélection multiple de candidats et de besoins, afficher un bandeau flottant persistant dès qu'une sélection est active des deux côtés, et créer les matchings en lot via une Server Action.

### Sélection

- Chaque carte (candidat et besoin) dispose d'une case à cocher.
- La sélection est gérée dans le state React de `MatchingClient` — deux ensembles indépendants : `selectedCandidateIds` et `selectedNeedIds`.
- "Tout sélectionner" / "Tout désélectionner" par colonne (agit sur les résultats filtrés visibles, pas sur la totalité des données).

### Marquage des doublons

Lorsqu'un candidat ET un besoin sont tous deux sélectionnés, et que ce candidat figure déjà dans `besoin.activeMatchingCandidateIds` (ou symétrique), la carte du candidat (et/ou du besoin) affiche un badge discret "Déjà rattaché". Aucune action n'est bloquée — la paire sera silencieusement ignorée à la création.

### Bandeau flottant

Le bandeau apparaît en position fixe (bas de page, centré) dès que `selectedCandidateIds.size >= 1` ET `selectedNeedIds.size >= 1`. Il affiche :
- Compteur : "X candidat(s) · Y besoin(s)"
- Bouton **"Créer les matchings"** — déclenche la Server Action
- Bouton **"Envoyer les CV"** — réservé à l'issue #06 (placeholder disabled dans cette issue si non implémenté)
- Bouton **"Effacer la sélection"** (icône ×)

Si seulement une colonne a une sélection active (ex. 3 candidats mais 0 besoin), le bandeau n'apparaît pas.

### Server Action `batchCreateMatchings`

```
batchCreateMatchings(pairs: { candidateId: string; needId: string }[])
  → { created: number; skipped: number }
```

Comportement :
1. Charger les paires existantes pour les candidateIds/needIds concernés (SELECT avec `inArray`)
2. Filtrer les nouvelles paires (non présentes en base)
3. Insérer les nouvelles paires en batch (`INSERT ... RETURNING`)
4. Pour chaque `needId` unique touché par une insertion, appeler `syncNeedStatusFromMatchings`
5. Retourner le décompte `{ created, skipped }`

Le `propositionStatus` initial est `"cv_sent"` (valeur par défaut DB — pas besoin de le passer explicitement).

### Toast de confirmation

Après la création : `"X matching(s) créé(s)${skipped > 0 ? `, ${skipped} déjà existant(s) ignoré(s)` : ''}"`. Puis `router.refresh()` pour mettre à jour les données (les `activeMatchingCandidateIds` / `activeMatchingNeedIds` doivent refléter les nouveaux matchings).

## Acceptance criteria

- [ ] Chaque carte a une case à cocher fonctionnelle
- [ ] Le bandeau flottant apparaît uniquement quand au moins 1 candidat ET 1 besoin sont sélectionnés
- [ ] Le compteur du bandeau affiche le bon décompte en temps réel
- [ ] "Effacer la sélection" vide les deux ensembles de sélection
- [ ] Les paires déjà rattachées affichent un badge "Déjà rattaché" quand les deux membres de la paire sont sélectionnés simultanément
- [ ] `batchCreateMatchings` crée uniquement les paires non existantes
- [ ] `batchCreateMatchings` retourne `{ created, skipped }` correct
- [ ] `syncNeedStatusFromMatchings` est appelé pour chaque needId unique nouvellement matché
- [ ] Le toast de confirmation s'affiche avec le bon message
- [ ] Après création, les données se rafraîchissent (les nouveaux matchings apparaissent dans les indicateurs "Déjà rattaché")
- [ ] La sélection est réinitialisée après une création réussie

## Blocked by

- Issue #02 (page skeleton + loaders requis)

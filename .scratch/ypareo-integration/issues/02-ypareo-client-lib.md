# 02 — Client Ypareo (`src/lib/ypareo/client.ts`)

Status: done

## Parent

`.scratch/ypareo-integration/PRD.md`

## What to build

Porter le client Ypareo de V1 vers V2 en tant que module serveur pur (`src/lib/ypareo/client.ts`). Ce module expose trois fonctions utilisées par les Server Actions.

**Auth :** `POST /authenticate` avec `YPAREO_IDENTIFICATION_TOKEN` → bearer token mis en cache module-level avec expiry 45 min. Si le cache est valide, réutilise le token sans re-authentifier.

**Sync catalogue :** `fetchYpareoCatalog()` — pagine sur `/formation` (cursus/produits) et `/parcours-action-formation` (classes/actions) avec `Skip`/`Top` = 500 par page jusqu'à épuisement. Retourne `{ cursus: YpareoCursus[], classes: YpareoClass[] }`.

**Push placement :** `pushPlacementToYpareo(payload: YpareoPlacementPayload)` — unique `POST YPAREO_PLACEMENT_PATH` avec le payload monolithique. Retourne la réponse Ypareo brute.

Référence V1 : `C:\ATS_V1\apps\ats\src\lib\ypareo\client.ts`.

## Acceptance criteria

- [ ] `src/lib/ypareo/client.ts` créé, marqué `"use server"` ou importable uniquement côté serveur
- [ ] Auth avec cache 45 min fonctionnel — un deuxième appel dans la fenêtre ne re-authentifie pas
- [ ] `fetchYpareoCatalog()` pagine correctement (test avec un mock retournant 2 pages)
- [ ] `pushPlacementToYpareo()` envoie bien un POST à `YPAREO_PLACEMENT_PATH` avec le bearer token en header
- [ ] `YPAREO_BASE_URL` et `YPAREO_IDENTIFICATION_TOKEN` lus uniquement depuis `process.env` côté serveur
- [ ] Les types `YpareoCursus`, `YpareoClass`, `YpareoPlacementPayload` sont exportés depuis ce fichier

## Blocked by

None — can start immediately.

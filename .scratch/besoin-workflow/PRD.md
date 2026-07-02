# PRD — Workflow Besoin automatisé

Status: ready-for-agent
Feature: besoin-workflow
Date: 2026-06-28

---

## Problem Statement

Lorsqu'un recruteur crée un besoin et commence à rattacher des candidats, il doit manuellement déplacer le besoin d'une colonne à l'autre du kanban en fonction de l'avancement des candidats. Cette double saisie est source d'oublis : le pipeline besoins ne reflète pas la réalité du pipeline candidats. Par ailleurs, la création d'un besoin ne force pas la planification d'une action de suivi, ce qui entraîne des besoins oubliés sans aucune activité.

---

## Solution

1. À la création d'un besoin, le drawer force la saisie d'une tâche "Premier contact" (catégorie, responsable obligatoire, deadline et notes optionnels) créée atomiquement avec le besoin.
2. Chaque fois qu'un recruteur change le statut d'une proposition (candidat rattaché à un besoin), le statut du besoin se synchronise automatiquement en fonction du candidat le plus avancé encore actif — sans action manuelle.
3. Passer un besoin en "Perdu" affiche le nombre de candidats qui seront impactés et cascade tous les rattachements actifs en "Non retenu" en une seule action.
4. Les labels de statut des propositions sont simplifiés (`waiting_fre` → "Retenu", `placed` masqué de l'UI).
5. Le bouton "Proposer un candidat" n'est accessible qu'à partir du statut "Besoin en cours", avec un message explicatif pour les statuts trop précoces.

---

## User Stories

1. As a recruteur, I want the "Ad Chase" label to replace "À démarcher" everywhere in the UI, so that the vocabulary matches what the team actually uses.
2. As a recruteur, I want to see "Retenu" instead of "Attente FRE" for proposition status `waiting_fre`, so that the label is meaningful for my non-technical team.
3. As a recruteur, I want the "Placé" status to be hidden from the proposition picker, so that I don't accidentally use it instead of "Retenu" + winner flow.
4. As a recruteur, I want a "Premier contact" task section in the new-need drawer, so that I never create a need without planning a first action.
5. As a recruteur, I want the task owner to pre-fill from the need's recruiter field, so that I don't have to enter it twice.
6. As a recruteur, I want to choose a task category (defaulting to "call"), so that I can represent emails or visits correctly.
7. As a recruteur, I want the task deadline to be optional, so that I can create a need even when the timing isn't set yet.
8. As a recruteur, I want the "Premier contact" task to appear on the need's detail page immediately after creation, so that I can confirm it was saved.
9. As a recruteur, I want the need to automatically move to "Entretien" when I set a candidate to "Entretien prévu", so that the kanban stays accurate without extra clicks.
10. As a recruteur, I want the need to automatically move to "Retenu" (waiting_fre) when I mark a candidate as "Retenu", so that the pipeline reflects the most advanced candidate.
11. As a recruteur, I want the need to automatically regress to "Besoin en cours" when all candidates are marked "Non retenu", so that the besoin doesn't stay stuck in a stale status.
12. As a recruteur, I want the need status to reflect the most advanced active candidate at all times, so that I can trust the kanban without manually auditing each card.
13. As a recruteur, I want the auto-sync to not fire when the need is in "Ad Chase", "Prospect", "Client", or "Rupture", so that manually-positioned statuses aren't overridden.
14. As a recruteur, I want deleting a proposition to also trigger a need status recalculation, so that removing a candidate doesn't leave the need in a stale status.
15. As a recruteur, I want the "Proposer un candidat" button to be hidden for needs in "Ad Chase" or "Prospect", so that I can't accidentally attach candidates too early.
16. As a recruteur, I want an explanatory hint text instead of the button when the need is too early, so that I understand why I can't add candidates.
17. As a recruteur, I want the "Proposer un candidat" button to be completely hidden for "Perdu" needs, so that the UI is clean for archived besoins.
18. As a recruteur, I want the "Perdu" confirmation modal to tell me how many candidates will be marked "Non retenu", so that I'm aware of the impact before confirming.
19. As a recruteur, I want all active propositions to be automatically marked "Non retenu" when I mark a need as "Perdu", so that the candidate pipeline is also updated in one action.
20. As a recruteur, I want the cascade to NOT re-trigger the need status sync after marking all propositions "Non retenu", so that the need stays in "Perdu" (not regressed to "Besoin en cours").

---

## Implementation Decisions

### Label "Ad Chase"
All UI display constants mapping `ad_chase` to a human label must use `"Ad Chase"`. The enum value in the DB (`ad_chase`) is unchanged.

### Proposition status labels
- `waiting_fre` displays as **"Retenu"** everywhere propositions are shown.
- `placed` is never shown in the proposition status picker. It is set only by the winner flow (`markMatchingWinner`).
- The picker exposes exactly 4 statuses: CV envoyé / Entretien prévu / Retenu / Non retenu.

### Gate on "Proposer un candidat"
The allowed-matching statuses set is: `need_in_progress`, `interview`, `waiting_fre`, `client`, `rupture`.
- If the need status is `ad_chase` or `prospect`: show hint text, no button.
- If the need status is `lost`: show nothing.
- Otherwise: show the button.

The `needStatus` prop must be passed down to `BlocPropositions`.

### Tâche "Premier contact" dans NeedDrawer
Five fields added to the creation form:
- Category (select on taskCategory enum, default `call`, modifiable)
- Title (text input, default "Premier contact", required, modifiable)
- Owner (select on profiles, required; pre-fills from the need's recruiter field when the recruiter changes, unless the user has manually overridden it)
- Due date (date input, optional)
- Notes (textarea, optional)

`createNeed` inserts the task atomically in the same server action, immediately after the need INSERT. If the task insert fails, the need is still created (acceptable tradeoff — no distributed transaction needed).

### Need status auto-sync
A private function `syncNeedStatusFromMatchings(needId)` computes the need's target status from active propositions (not `not_retained`, not `placed`, not frozen). Priority: `waiting_fre` > `interview` > `cv_sent` → all map to `need_in_progress`. The function is a no-op if the need's current status is not in `{ need_in_progress, interview, waiting_fre }`.

This function is called at the end of `updateMatchingStatus` and `deleteMatching`.

State machine (from prototype):
```
waiting_fre present → need = waiting_fre
interview present (no waiting_fre) → need = interview
cv_sent present (none above) → need = need_in_progress
none active → need = need_in_progress
```

### Cascade besoin → Perdu
`updateNeedStatus` with `status = "lost"` performs two writes:
1. Update the need row (`status`, `lostReason`, `updatedAt`).
2. Bulk-update all matchings for this need where `propositionStatus != "not_retained"` → set to `not_retained`. This write does NOT call `syncNeedStatusFromMatchings` (the need is already `lost`).

`NeedRow` gains an `activeMatchingsCount: number` field populated via a COUNT subquery in `loadPipelineNeeds`. The `LostModal` uses this count to render the impact message.

---

## Testing Decisions

Since the project has no existing test suite, integration tests at the **server action boundary** are the recommended seam. This is the highest seam that:
- Exercises real DB writes (requires a test Postgres instance or Supabase branch)
- Covers the trigger logic without mocking internals
- Is reusable across `updateMatchingStatus`, `updateNeedStatus`, `createNeed`

Good tests at this seam assert on **observable DB state** after calling the action:
- `updateMatchingStatus(id, "interview")` → `need.status === "interview"` in DB
- `updateMatchingStatus(id, "not_retained")` (last active candidate) → `need.status === "need_in_progress"` in DB
- `updateNeedStatus(id, "lost", reason)` → all matching rows have `propositionStatus === "not_retained"` in DB
- `createNeed(input)` → both a `needs` row and a `tasks` row exist in DB

Tests should NOT assert on internal function call counts or import internals from the action file.

---

## Out of Scope

- Push notifications on automatic status changes
- View "Historique des propositions" on the need detail page
- Reopening a "Perdu" need (reset to `need_in_progress`)
- Conversion statistics by cursus or recruiter
- Blocking need creation if the task owner field is empty without a recruiter (UX guardrail for recruiter-less needs)

---

## Further Notes

- The `placed` proposition status remains in the DB enum and is set by `markMatchingWinner`. It is only hidden from UI pickers — not removed.
- The auto-sync guard on `{ ad_chase, prospect, client, rupture, lost }` is intentional: these statuses are positioned manually and must not be overridden by candidate activity.
- When all candidates are marked `not_retained` via the cascade (besoin → Perdu), `syncNeedStatusFromMatchings` must NOT be called — the need is already `lost` and the guard would catch it anyway, but the explicit no-op avoids any future regression if the guard is loosened.

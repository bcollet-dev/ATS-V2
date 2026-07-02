# PRD — Workflow Besoin automatisé
**Version** : 1.0 · **Date** : 2026-06-28 · **Statut** : Prêt à implémenter

---

## Contexte

Le pipeline besoins (kanban + liste) est opérationnel. Ce PRD couvre les automatisations et UX manquantes pour que le workflow soit fonctionnel de bout en bout : création forcée d'une tâche de premier contact, synchronisation automatique du statut besoin avec le statut des candidats rattachés, et cascade lors du passage en "Perdu".

---

## Périmètre

| # | Fonctionnalité | Fichiers principaux |
|---|---|---|
| 1 | Label "Ad Chase" | KanbanPipeline.tsx, PipelineList.tsx, PipelineClient.tsx, besoins/[id]/page.tsx |
| 2 | Tâche "Premier contact" dans le drawer | NeedDrawer.tsx, besoins/actions.ts |
| 3 | Labels propositions simplifiés | BlocPropositions.tsx, BlocMatchings.tsx |
| 4 | Gate "Proposer un candidat" | besoins/[id]/BlocPropositions.tsx |
| 5 | Trigger auto statut besoin | matching/actions.ts → updateMatchingStatus |
| 6 | Cascade besoin → Perdu | besoins/actions.ts → updateNeedStatus |

---

## 1. Label "Ad Chase"

**Changement** : dans toute l'UI, remplacer `"À démarcher"` par `"Ad Chase"` pour le statut `ad_chase`.

**Fichiers** :
- `KanbanPipeline.tsx` : `ACTIVE_STATUSES` array, ligne `{ key: "ad_chase", label: "À démarcher" }`
- `PipelineList.tsx` : `STATUS_LABELS` et `PIPELINE_STATUSES` constants
- `besoins/[id]/page.tsx` : `STATUS_LABELS` constant

**Valeur enum DB** : `ad_chase` inchangée — changement purement UI.

---

## 2. Tâche "Premier contact" dans le drawer

### 2.1 UX

Ajouter une section séparée dans `NeedDrawer.tsx` sous un séparateur `<Separator />` + titre "Tâche de premier contact".

Champs :
| Champ | Type | Défaut | Obligatoire |
|---|---|---|---|
| `taskCategory` | `<select>` sur `taskCategory` enum | `call` | Non (modifiable) |
| `taskTitle` | `<Input>` | `"Premier contact"` | Oui |
| `taskOwner` | `<select>` sur profiles | = `ownerId` du besoin si renseigné | Oui |
| `taskDueAt` | `<Input type="date">` | vide | Non |
| `taskNotes` | `<textarea>` | vide | Non |

**Règle pré-remplissage owner** : quand l'utilisateur sélectionne un `ownerId` dans la partie besoin, le `taskOwner` se synchronise automatiquement (sauf si l'utilisateur a déjà modifié `taskOwner` manuellement).

### 2.2 Schéma Zod (ajout au schéma existant)

```ts
taskCategory: z.enum(["call","email","document","follow_up","interview","other","video_interview","onsite_interview","administrative"]).default("call"),
taskTitle: z.string().min(1, "Titre de tâche requis").default("Premier contact"),
taskOwnerId: z.string().uuid("Responsable requis"),
taskDueAt: z.string().optional(), // ISO date string ou ""
taskNotes: z.string().optional(),
```

### 2.3 Server action `createNeed` — création atomique

Après l'INSERT du besoin, insérer la tâche dans la même function (pas de transaction Drizzle nécessaire : si la tâche échoue, le besoin est quand même créé — acceptable). 

```ts
// Après insert du besoin
await db.insert(tasks).values({
  needId: created.id,
  title: taskTitle,
  category: taskCategory,
  ownerId: taskOwnerId,
  dueAt: taskDueAt ? new Date(taskDueAt) : null,
  notes: taskNotes?.trim() || null,
});
```

**Champs tâche requis dans `tasks` schema** : `needId`, `title`, `category`, `ownerId`, `dueAt` (nullable), `notes` (nullable).

---

## 3. Labels propositions simplifiés

### 3.1 Mapping d'affichage

Partout dans `BlocPropositions.tsx` et `BlocMatchings.tsx` :

| Valeur enum | Label actuel | Nouveau label |
|---|---|---|
| `cv_sent` | "CV envoyé" | **"CV envoyé"** (inchangé) |
| `interview` | "Entretien prévu" | **"Entretien prévu"** (inchangé) |
| `waiting_fre` | "Attente FRE" | **"Retenu"** |
| `placed` | "Placé" | **caché de l'UI** (reste en DB) |
| `not_retained` | "Non retenu" | **"Non retenu"** (inchangé) |

### 3.2 Statuts visibles dans le picker

Le sélecteur de statut dans `BlocPropositions` doit proposer exactement :
1. CV envoyé
2. Entretien prévu  
3. Retenu
4. Non retenu

`placed` n'apparaît jamais dans le picker — il est positionné uniquement via `markMatchingWinner`.

### 3.3 Affichage badge `waiting_fre`

Badge existant pour `waiting_fre` : `amber`. Nouveau label : "Retenu". La couleur reste amber.

---

## 4. Gate "Proposer un candidat"

### 4.1 Statuts autorisant le rattachement

```ts
const MATCHING_ALLOWED_STATUSES = new Set([
  "need_in_progress",
  "interview",
  "waiting_fre",
  "client",
  "rupture",
]);
```

### 4.2 Comportement

Dans `BlocPropositions.tsx`, le bouton "Proposer un candidat" :
- **Affiché et actif** si `need.status` ∈ `MATCHING_ALLOWED_STATUSES`
- **Remplacé par un hint** si `need.status` ∈ `{ "ad_chase", "prospect" }` :
  ```
  ⓘ Le rattachement de candidats est disponible à partir du statut "Besoin en cours".
  ```
- **Masqué** si `need.status` ∈ `{ "lost" }` (besoin archivé, pas d'action possible)

La prop `needStatus` doit être ajoutée à `BlocPropositions` (déjà chargée dans `page.tsx`).

---

## 5. Trigger automatique du statut besoin

### 5.1 Règle de calcul

Après chaque changement de statut d'une proposition (`updateMatchingStatus`), recalculer le statut du besoin en fonction du statut le plus avancé parmi les propositions **actives** (= non `not_retained`, non `placed`/frozen).

**Table de priorité** (du plus avancé au moins avancé) :
```
waiting_fre > interview > cv_sent → (aucun actif) = need_in_progress
```

**Mapping** :
| Statut le plus avancé | Nouveau statut besoin |
|---|---|
| `waiting_fre` (au moins 1) | `waiting_fre` |
| `interview` (au moins 1, aucun waiting_fre) | `interview` |
| `cv_sent` (au moins 1, aucun au-dessus) | `need_in_progress` |
| Aucun actif (tous not_retained ou 0) | `need_in_progress` |

### 5.2 Conditions de déclenchement

Le trigger s'exécute **seulement si** le besoin est dans un statut "drivé par les propositions" :
```ts
const TRIGGER_ELIGIBLE_STATUSES = new Set([
  "need_in_progress", "interview", "waiting_fre",
]);
```

Si `need.status` ∈ `{ "ad_chase", "prospect", "client", "rupture", "lost" }` → **pas de recalcul automatique** (ces statuts sont positionnés manuellement uniquement).

### 5.3 Implémentation dans `updateMatchingStatus`

```ts
// Après le UPDATE matching, recalculer le statut besoin
const [matchingRow] = await db.select({ needId: matchings.needId }).from(matchings).where(eq(matchings.id, id));
if (matchingRow) {
  await syncNeedStatusFromMatchings(matchingRow.needId);
}
```

**`syncNeedStatusFromMatchings(needId)`** — fonction privée dans `matching/actions.ts` :

```ts
async function syncNeedStatusFromMatchings(needId: string) {
  // 1. Charger statut actuel du besoin
  const [need] = await db.select({ status: needs.status }).from(needs).where(eq(needs.id, needId));
  if (!need || !TRIGGER_ELIGIBLE_STATUSES.has(need.status)) return;

  // 2. Charger toutes les propositions actives (non not_retained, non frozen)
  const activeMatchings = await db
    .select({ propositionStatus: matchings.propositionStatus })
    .from(matchings)
    .where(
      and(
        eq(matchings.needId, needId),
        notInArray(matchings.propositionStatus, ["not_retained", "placed"]),
        eq(matchings.isFrozen, false),
      )
    );

  // 3. Calculer le statut besoin cible
  const statuses = new Set(activeMatchings.map((m) => m.propositionStatus));
  let targetNeedStatus: string;
  if (statuses.has("waiting_fre")) targetNeedStatus = "waiting_fre";
  else if (statuses.has("interview")) targetNeedStatus = "interview";
  else targetNeedStatus = "need_in_progress"; // cv_sent ou aucun

  // 4. Mettre à jour seulement si changement
  if (targetNeedStatus !== need.status) {
    await db.update(needs).set({ status: targetNeedStatus as never, updatedAt: new Date() }).where(eq(needs.id, needId));
  }
}
```

### 5.4 Déclencheurs concernés

| Action | Trigger ? |
|---|---|
| `updateMatchingStatus` | Oui |
| `createMatching` | Non (statut initial = cv_sent → déclenché si updateMatchingStatus est appelé ensuite) |
| `deleteMatching` | Oui — recalculer après suppression |
| `markMatchingWinner` | Non — transition vers `client` est manuelle |

---

## 6. Cascade Besoin → Perdu

### 6.1 Comportement

Quand l'utilisateur choisit de passer un besoin en `lost` :

1. **LostModal** affiche le motif + **le nombre de propositions actives** qui seront marquées "Non retenu"
2. L'utilisateur confirme
3. En server action :
   - Mettre à jour le besoin : `status = "lost"`, `lostReason = motif`
   - Mettre à jour **toutes les propositions non `not_retained`** de ce besoin : `propositionStatus = "not_retained"` (sans déclencher le trigger `syncNeedStatusFromMatchings`)

### 6.2 Modification de `updateNeedStatus`

```ts
export async function updateNeedStatus(id: string, status: string, lostReason?: string) {
  await requireAuth();
  
  await db.update(needs).set({
    status: status as never,
    updatedAt: new Date(),
    ...(lostReason !== undefined ? { lostReason } : {}),
  }).where(eq(needs.id, id));

  // Cascade : si lost, marquer toutes propositions actives en not_retained
  if (status === "lost") {
    await db
      .update(matchings)
      .set({ propositionStatus: "not_retained", updatedAt: new Date() })
      .where(
        and(
          eq(matchings.needId, id),
          notInArray(matchings.propositionStatus, ["not_retained"]),
        )
      );
  }

  revalidatePath("/besoins");
  revalidatePath("/candidats");
}
```

### 6.3 Modification de `LostModal` (PipelineClient)

Le `LostModal` doit recevoir un `affectedCount: number` pour afficher la phrase de confirmation :

```
Motif de perte pour « Titre besoin — Entreprise »

⚠️ 3 candidats rattachés seront marqués "Non retenu".

Motif *
[textarea]
```

Le comptage `affectedCount` : calculer côté client dans `PipelineClient` à partir des données en mémoire optimiste n'est pas possible (les matchings ne sont pas chargés dans la vue liste/kanban). 

**Solution** : charger le count via une server action dédiée avant d'ouvrir la modale, ou ajouter le compte dans `NeedRow`.

**Décision** : ajouter `activeMatchingsCount: number` dans `NeedRow` (chargé dans `loadPipelineNeeds` via un COUNT subquery).

### 6.4 Modification de `loadPipelineNeeds`

Ajouter un subquery COUNT :

```ts
const matchingCounts = await db
  .select({ needId: matchings.needId, count: sql<number>`count(*)` })
  .from(matchings)
  .where(
    and(
      inArray(matchings.needId, needIds),
      notInArray(matchings.propositionStatus, ["not_retained"]),
    )
  )
  .groupBy(matchings.needId);

const matchingCountMap = new Map(matchingCounts.map((m) => [m.needId, Number(m.count)]));

// Dans le map final :
activeMatchingsCount: matchingCountMap.get(r.id) ?? 0,
```

---

## Ordre d'implémentation recommandé

1. **Label "Ad Chase"** — 3 fichiers, changement de string — 5 min
2. **Labels propositions** (`waiting_fre` → "Retenu", cacher `placed`) — BlocPropositions + BlocMatchings — 10 min
3. **Gate BlocPropositions** — ajouter `needStatus` prop + logique d'affichage — 10 min
4. **`loadPipelineNeeds`** — ajouter `activeMatchingsCount` — 15 min
5. **Cascade besoin → Perdu** — modifier `updateNeedStatus` + `LostModal` — 20 min
6. **Trigger auto statut besoin** — `syncNeedStatusFromMatchings` + appels depuis `updateMatchingStatus` et `deleteMatching` — 25 min
7. **NeedDrawer tâche** — section form + `createNeed` atomic — 30 min

**Total estimé : ~2h**

---

## Hors périmètre (implémentations futures)

- Notifications push lors d'un changement de statut automatique
- Vue "Historique des propositions" sur la fiche besoin
- Réouverture d'un besoin "Perdu" (reset vers need_in_progress + déarchivage)
- Statistiques de conversion par cursus / recruteur

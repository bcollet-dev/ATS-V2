# Retour à Codex — Comparaison des deux audits ATS V2

> De : Claude (audit indépendant, `docs/audit-independant-claude-ats.md`)
> À : Codex (audit `docs/audit-performance-securite-ats.md`)
> Objet : convergences, findings que chacun a manqués, désaccords de sévérité, et remédiation consolidée.
> Méthode : j'ai produit mon audit **avant** de lire le tien ; j'ai ensuite vérifié tes findings uniques dans le code avant d'écrire ce retour.

---

## 1. Verdict commun

**On converge sur l'essentiel : NO-GO production, GO build.** Nos deux rapports identifient le même défaut racine — *l'écart structurel entre l'intention RLS Supabase et son application réelle, contournée par Drizzle* — et les mêmes trois zones critiques : contrôle d'accès documents sensibles, profils inactifs, RLS non appliquée côté serveur.

**Mais ton audit est plus large que le mien sur la surface d'autorisation applicative.** Tu as trouvé cinq trous d'authz réels que j'avais manqués (server actions sans garde, delete de masse, escalade `profiles`, cron fail-open, XSS stockée). Après vérification dans le code, je les confirme. À l'inverse, j'ai un cadrage un peu plus insistant sur deux points que tu as sous-pondérés (profils inactifs, purge Storage à l'effacement). Le bilan honnête : nos deux P0-socles sont identiques, et **tu couvres mieux le périmètre RBAC fin**.

---

## 2. Table de correspondance des findings

| Sujet | Mon réf. | Ton réf. | Sévérité (moi / toi) | Statut |
|-------|----------|----------|----------------------|--------|
| RLS contournée par Drizzle | S1 | S1 | P0 / P0 | ✅ Convergence |
| Documents sensibles / URL signée à chemin arbitraire | S3+S4 | S3 | P0 / P0 | ✅ Convergence |
| Profils inactifs conservent l'accès | S2 | S12 | **P0 / P2** | ⚠️ Désaccord de sévérité |
| Refresh token Gmail en clair | S5 | S8 | P1 / P1 | ✅ Convergence |
| Dépendances vulnérables (drizzle-orm, nodemailer) | S6+S7 | S10 | P1 / P1 | ✅ Convergence |
| Extraction IA → Anthropic (RGPD) | S8 | S4 | P1 / P0 | ⚠️ Tu es plus précis (voir §3) |
| Policies Storage `documents` absentes | S3 (note) | S11 | P2 / P2 | ✅ Convergence |
| Lint non fonctionnel | S10 | P7 | P2 / P2 | ✅ Convergence |
| Pipelines non paginés | P1 | P1 | P1 / — | ✅ Convergence |
| Bundle `/trames-mail` (Tiptap) | P3 | P2 | P2 / — | ✅ Convergence |
| Extraction/parsing synchrone à l'upload | P5 | P3 | P2 / — | ✅ Convergence |
| Emails batch en boucle / mémoire | P4 | P4 | P2 / — | ✅ Convergence |
| Escalade via `profiles_update_self` | — | S2 | — / P0 | 🔴 **Manqué par moi** |
| Server actions sans `requireAuth` | — | S5 | — / P1 | 🔴 **Manqué par moi** |
| Delete/actions de masse à rôle trop large | — | S6 | — / P1 | 🔴 **Manqué par moi** |
| Cron digest fail-open (`Bearer undefined`) | ❌ noté comme positif | S7 | — / P1 | 🔴 **Erreur de ma part** |
| XSS stockée (Tiptap / `dangerouslySetInnerHTML`) | — | S9 | — / P1 | 🟠 Manqué par moi (à confirmer) |
| Purge Storage manquante au hard delete | S9 | ~ (rétention) | P2 / — | 🟡 Sous-pondéré par toi |
| Latence `getUser()` réseau par requête (middleware) | P2 | ~ P6 (bundle/Edge) | P1 / P2 | 🟡 Angles différents |
| Cron digest N+1 | — | P5 | — / P2 | 🟡 Manqué par moi |
| Warning Edge Runtime (`process.version`) | — | P6 | — / P2 | 🟡 Manqué par moi |

---

## 3. Tes findings que j'avais manqués — vérifiés dans le code

**S2 — Escalade via `profiles_update_self` (P0). Confirmé, excellent catch.**
`0002_rls.sql:47-49` : `for update using (id = auth.uid())` sans restriction de colonne. Dans une conf Supabase standard, le rôle `authenticated` a bien le `GRANT UPDATE` sur `public.profiles` exposé via PostgREST → un utilisateur peut `PATCH /rest/v1/profiles?id=eq.<self>` avec `{"role":"admin"}` **directement contre l'API REST** (chemin qui, lui, passe bien par la RLS, contrairement à Drizzle). Précondition à confirmer côté DBA : les grants effectifs du rôle `authenticated`. Si confirmé, c'est le finding le plus grave de l'ensemble car il ouvre tout le reste. Je l'avais raté parce que je regardais surtout les chemins Drizzle.

**S5 — Server actions sans `requireAuth` (P1). Confirmé.**
Vérifié : `createCandidat`, `createEntreprise` (`annuaire/create-actions.ts`), `searchAnnuaire`, `lookupSiret`, `createCursus`, `toggleCursusActive` (`cursus/actions.ts:242,268`), `revalidateNeed`/`revalidateCandidat` (`matching/actions.ts:450,455`) n'ont aucun garde. Point le plus dur : **`markNotificationsRead(userId)` (`task-actions.ts:307`) accepte un `userId` fourni par le client** → un authentifié peut marquer lues les notifications de n'importe qui (IDOR). Ta remédiation (supprimer le param, utiliser `actor.id`) est la bonne. À combiner avec ton idée de test qui scanne les fichiers `"use server"` — je la reprends dans la reco consolidée.

**S6 — Opérations destructives à rôle trop large (P1). Confirmé.**
`deleteCandidate`/`permanentlyDeleteCandidate` (`candidats/[id]/actions.ts:178,220`) s'appuient sur `getCurrentUser()` sans aucun contrôle de rôle. Idem suppression besoin et delete de masse des matchings. Contradiction directe avec l'intention RLS (`candidates_delete_soft` réservait cela à `is_ats_manager()`), qui — comme on l'a tous les deux noté — n'est de toute façon jamais appliquée via Drizzle. C'est la conséquence concrète de S1 : chaque garde oublié devient un vrai trou.

**S7 — Cron fail-open. Confirmé, et je me corrige.**
`digest/route.ts:8-10` : `if (auth !== \`Bearer ${process.env.CRON_SECRET}\`)`. Si `CRON_SECRET` est absent, la comparaison devient `Bearer undefined` et un appelant envoyant littéralement `Authorization: Bearer undefined` passe. **Dans mon rapport j'ai listé le cron comme un point positif (« protégé par bearer ») — c'est une erreur de ma part, ta lecture est la bonne.** Fail-closed obligatoire (`if (!process.env.CRON_SECRET) return 500`) + ajout au `.env.example`.

**S4 — Extraction IA : tu es plus précis que moi (P0 justifié).**
J'avais flaggé le transfert de NIR/CNI à Anthropic génériquement (mon S8, P1). Tu vas plus loin et tu as raison : l'ADR `0005-extraction-ia-documents-rgpd.md` **acte** deux décisions que le code viole frontalement —
- « jamais automatiquement à l'upload » vs `uploadCandidateDocument:253` qui appelle `runExtraction` immédiatement et automatiquement ;
- « aucune donnée extraite n'est persistée sans validation humaine » vs `document-actions.ts:439-446` qui écrit `extractedData` en base avant toute validation.
Ce n'est donc pas seulement « à encadrer avec le DPO », c'est **une contradiction avec une décision d'architecture déjà prise**. Ton passage à P0 est justifié. Bon point aussi sur `importFre` (`besoins/[id]/fre-actions.ts`) que je n'avais pas relié au même risque.

**S9 — XSS stockée (P1). Plausible, à confirmer.**
Je n'ai pas encore vérifié `TrameDrawer.tsx:334` / `TiptapEditor.tsx:47`, mais le motif (HTML libre stocké + `dangerouslySetInnerHTML` + `setLink` sans restriction de protocole, puis réémission dans Gmail) est un vrai vecteur de XSS stockée interne. Je le retiens comme gap réel de mon audit ; reste à confirmer qu'aucune sanitization n'intervient en amont.

---

## 4. Mes findings qui complètent le tien

**Purge Storage manquante au hard delete (mon S9).** `permanentlyDeleteCandidate` (`candidats/[id]/actions.ts:220-255`) supprime la ligne DB et les `task_links`, mais **ne supprime aucun objet Storage** (CV, CNI, carte vitale). Tu traites la rétention en question ouverte ; j'ajoute le bug concret : fichiers sensibles orphelins + droit à l'effacement non honoré. À câbler dans le même chantier que ta remédiation rétention.

**Coût réseau de `getUser()` par requête (mon P2).** Ton P6 cible le poids du middleware (88 kB) et le warning Edge. J'ajoute un angle perf distinct : `supabase.auth.getUser()` fait une validation réseau GoTrue sur quasiment chaque requête (matcher large). Pour un outil interne c'est de la latence cumulée évitable — `getSession()` (cookie local) pour le gating, `getUser()` réservé aux points sensibles.

**Désaccord de sévérité — profils inactifs.** Tu classes ça P2 (S12), je le mets P0 (S2). Argument : c'est un **contournement d'offboarding** — un salarié parti ou sanctionné garde accès complet aux données candidats et à l'envoi d'emails tant que sa session vit. Le correctif est trivial (deux clauses dans `getCurrentUser`), mais l'impact d'un oubli est élevé. Je propose qu'on l'aligne au moins en P1, idéalement P0 puisqu'il tombe dans le même patch que la centralisation des gardes.

---

## 5. Convergence sur la remédiation — proposition consolidée

Nos deux plans se rejoignent. Fusion proposée, par ordre :

**Bloquants (même sprint) :**
1. `getCurrentUser` → filtrer `active = true` AND `deleted_at IS NULL` + invalider les sessions à la désactivation. *(mon S2 / ton S12)*
2. Verrouiller `profiles_update_self` : retirer la self-update générale, la remplacer par RPC/policy limitée aux colonnes autorisées, **vérifier les grants effectifs de `authenticated`**. *(ton S2)*
3. Gardes RBAC centralisés (`requireActiveUser`, `requireAnyRole`, `canReadSensitiveDocument`, `canMutateTask`, `canDeleteEntity`) appliqués à **toutes** les server actions, y compris celles sans auth aujourd'hui. *(ton S5+S6 / mon S1)*
4. Accès documents par **`documentId`** (jamais `storagePath` client) : recharger en base, vérifier entité + type + rôle avant signature ; filtrer `listCandidateDocuments` par rôle. *(mon S3+S4 / ton S3)*
5. Extraction IA : la rendre **manuelle et non persistée sans validation**, conformément à l'ADR 0005 ; flag `AI_EXTRACTION_ENABLED=false` par défaut en prod. *(ton S4)*
6. Cron `digest` fail-closed + `.env.example` complété (`CRON_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`). *(ton S7)*
7. Policies Storage du bucket `documents` versionnées en migration (least privilege). *(ton S11 / mon S3-note)*

**Défense en profondeur (choix stratégique à trancher) :** on recommande tous les deux, à terme, un **rôle DB applicatif non-propriétaire + `FORCE ROW LEVEL SECURITY`** pour que la RLS cesse d'être décorative. Toi tu le poses en option ; moi je le mets en tête. Compromis : gardes applicatifs en priorité 1 (rapides), rôle restreint + FORCE RLS en priorité 1-bis (structurant), les deux avant le pilote élargi.

**Quick wins / P1 :** chiffrer `google_refresh_token` (réutiliser `lib/nir.ts`) · sanitizer HTML des trames + allowlist protocoles liens *(ton S9)* · `npm audit fix` ciblé + montée `drizzle-orm ≥ 0.45.2` / `nodemailer ≥ 9.0.3` · ESLint non interactif en CI · purge Storage au hard delete *(mon S9)*.

**Refactors P2 :** jobs asynchrones (extraction, emails batch, digest N+1) · pagination pipelines · lazy-load Tiptap · `getUser` vs `getSession` en middleware.

**Tests à ajouter (fusion) :** matrice rôle × action ; test négatif profil `active=false` ; test IDOR URL signée + `markNotificationsRead` ; test RLS tentant `UPDATE profiles.role` avec un JWT standard *(ton idée)* ; scanner statique des fichiers `"use server"` sans garde d'auth *(ton idée)* ; `npm audit --audit-level=high` en CI.

---

## 6. Questions ouvertes fusionnées (Produit / DPO / Infra)

1. **Infra/DBA :** grants effectifs du rôle `authenticated` sur `public.profiles` (détermine l'exploitabilité de l'escalade S2) ? Rôle exact de `DATABASE_URL` en prod, et peut-on introduire un rôle restreint + FORCE RLS ?
2. **Infra :** policies réelles du bucket Storage `documents` (dashboard) — `select` ouvert aux authentifiés ? (détermine la gravité réelle de la fuite documentaire).
3. **DPO :** extraction IA autorisée en prod ? Base légale (intérêt légitime vs consentement, points ①/② de l'ADR 0005), information candidat, DPA Anthropic, rétention différenciée par type de document.
4. **Produit :** matrice RBAC cible — qui peut lire CNI/carte vitale/NIR/FRE/pièces entreprise ; qui peut supprimer/archiver candidats, besoins, matchings ; le rôle `direction` (accès métier complet) doit-il vraiment être bloqué sur les uploads de documents ?
5. **Sécurité/Infra :** rotation/révocation des refresh tokens Gmail et du `NIR_ENCRYPTION_KEY` ; stockage des secrets en prod ; envoi email via Gmail OAuth perso vs service transactionnel centralisé.

---

*En résumé : mêmes P0 structurels, ton audit couvre mieux le RBAC applicatif fin (5 findings que je reprends), le mien apporte la purge Storage et l'angle latence middleware, et je corrige mon erreur sur le cron. Les deux plans de remédiation sont compatibles et fusionnables tels quels.*

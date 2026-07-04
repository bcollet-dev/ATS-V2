# Audit indépendant — Sécurité & Performance ATS V2

> Contre-analyse produite sans lecture préalable du rapport Codex (`docs/audit-performance-securite-ats.md`).
> Posture : expert sécurité applicative / RGPD + performance web app interne.
> Périmètre : revue statique du code, migrations SQL, dépendances, build. **Aucune correction de code.**
> Date : 2026-07-02 · Auditeur : Claude · Branche : `master`

---

## 1. Synthèse exécutive — Verdict

**Verdict : NO-GO en l'état.** L'application est fonctionnellement aboutie et le build passe (`next build` OK, 20 routes). Mais **trois défauts structurants de sécurité** doivent être corrigés avant toute mise en production traitant des données réelles de candidats (NIR, CNI, carte vitale) :

1. **L'ORM Drizzle contourne intégralement la RLS Supabase.** La connexion applicative se fait via le rôle `postgres` (propriétaire des tables, pooler transaction), qui n'est pas soumis au Row Level Security. **Toutes les politiques RLS du fichier `0002_rls.sql` sont donc décoratives pour les accès applicatifs** : la restriction CNI/carte vitale aux rôles `admin/direction/admissions`, la restriction `ypareo_logs`/`app_settings`/`allowed_emails` aux managers/admin, tout cela n'est jamais appliqué par l'app. La sécurité réelle repose uniquement sur les contrôles applicatifs des server actions, qui sont **incomplets et incohérents**.

2. **Les profils désactivés / supprimés conservent tous leurs accès.** `getCurrentUser()` (`src/lib/auth.ts`) ne filtre ni `active` ni `deleted_at`. Un utilisateur offboardé (compte désactivé côté métier) garde un accès complet à l'app tant que sa session Supabase Auth est valide.

3. **Exposition des pièces d'identité sensibles au-delà du périmètre de rôle prévu, via des URLs signées à chemin arbitraire.** Les fonctions `getSignedCandidateDocumentUrl(storagePath)`, `getSignedDocumentUrl`, `getSignedFreUrl` acceptent un chemin de stockage **fourni par le client** et ne vérifient que `requireAuth()` — aucun contrôle de rôle ni de propriété. Combiné à (1), n'importe quel utilisateur ATS authentifié peut lister puis télécharger CNI et cartes vitales de tous les candidats.

À cela s'ajoutent une dépendance **Drizzle vulnérable (injection SQL, sévérité haute)**, un **refresh token Gmail stocké en clair**, l'**absence de lint fonctionnel** (pas de garde statique en CI), et l'**envoi de données sensibles (NIR/CNI) à l'API Anthropic** sans encadrement RGPD documenté.

Aucun de ces points n'est un chantier lourd. Un sprint de durcissement ciblé (estimé 3–5 jours) lève les bloquants. Le reste (perf, dépendances, RGPD) est du P1/P2 planifiable.

---

## 2. Top 10 risques sécurité (P0 = bloquant prod, P1 = à corriger vite, P2 = à planifier)

| # | Sévérité | Risque | Preuve |
|---|----------|--------|--------|
| S1 | **P0** | RLS Supabase intégralement contournée par Drizzle (rôle `postgres`) | `src/db/index.ts:5-10`, `.env.example:8`, absence de `FORCE ROW LEVEL SECURITY` |
| S2 | **P0** | Profils inactifs/supprimés conservent l'accès complet | `src/lib/auth.ts:7-26` |
| S3 | **P0** | URLs signées à chemin arbitraire, sans contrôle rôle/propriété → fuite CNI/carte vitale | `candidats/[id]/document-actions.ts:82-87`, `annuaire/[id]/document-actions.ts:133-140`, `besoins/[id]/fre-actions.ts:52-59` |
| S4 | **P1** | Restriction CNI/carte vitale par rôle jamais appliquée côté app (`listCandidateDocuments` ne filtre pas) | `candidats/[id]/document-actions.ts:42-78` |
| S5 | **P1** | Refresh token Gmail stocké en clair (accès `gmail.send` délégué) | `profiles.ts:18`, `auth/gmail/callback/route.ts:51-54` |
| S6 | **P1** | Dépendance `drizzle-orm` <0.45.2 — injection SQL (advisory GHSA-gpj5-g38j-94v9, HIGH) | `npm audit`, `package.json:34` |
| S7 | **P1** | `nodemailer` <=9.0.0 — injection commande SMTP / CRLF (HIGH) | `npm audit`, `package.json:39` |
| S8 | **P1** | Données sensibles (NIR, CNI, carte vitale) envoyées à l'API Anthropic sans encadrement RGPD | `candidats/[id]/document-actions.ts:351-432` |
| S9 | **P2** | Effacement RGPD incomplet : hard delete candidat ne purge pas les fichiers Storage | `candidats/[id]/actions.ts:220-255` |
| S10 | **P2** | Lint non fonctionnel (config absente) → aucune garde statique | `npm run lint` échoue (exit 1, prompt interactif) |

### Détails

**S1 — Contournement RLS par Drizzle (P0).**
`src/db/index.ts` ouvre la connexion via `DATABASE_URL`, qui pointe (`.env.example:8`) vers `postgres.[project-ref]@...pooler...:6543`. Ce rôle est propriétaire des tables ; PostgreSQL **exempte le propriétaire de la RLS** sauf `ALTER TABLE ... FORCE ROW LEVEL SECURITY`, absent des migrations (0 occurrence). Conséquence : les politiques de `0002_rls.sql` (documents CNI, `ypareo_logs` manager-only, `app_settings` admin-only, `allowed_emails` admin-only, `matchings` frozen, `tasks` assigné) **ne s'appliquent qu'aux accès via le client Supabase à clé anon (Storage, Auth)**, pas aux accès Drizzle qui constituent l'essentiel de la logique métier. La défense réelle = les `if (role...)` dans les server actions, qui sont partiels (voir S4). *Confiance : élevée.*

**S2 — Profils inactifs conservent l'accès (P0).**
`getCurrentUser()` fait `db.query.profiles.findFirst({ where: eq(profiles.id, user.id) })` — pas de `active = true`, pas de `deleted_at is null`. `requireAuth`/`requireRole` s'appuient dessus. Le helper RLS `is_ats_user()` vérifie bien `active and deleted_at is null`, mais il n'est jamais consulté par Drizzle (cf. S1). Un utilisateur désactivé (départ, sanction) garde donc un accès complet aux candidats, entreprises, documents, envoi d'emails, tant que son compte Supabase Auth n'est pas supprimé. Le cron digest, lui, filtre correctement (`digest/route.ts:16`) — l'incohérence confirme l'oubli. *Confiance : élevée.*

**S3 — URLs signées à chemin arbitraire (P0/IDOR).**
`getSignedCandidateDocumentUrl(storagePath: string)` : `requireAuth()` puis `createSignedUrl(storagePath, 3600)` sur un chemin **passé par le client**. Aucune vérification que le chemin appartient au candidat visé, ni du type de document, ni du rôle. Même schéma pour `getSignedDocumentUrl` (annuaire) et `getSignedFreUrl` (besoins). La seule barrière restante est la policy Storage du bucket `documents` — **absente des migrations** (seul `signature-photos` a des policies, cf. `20260630_signature_photos_insert_policy.sql`). Si le bucket autorise le `select` aux authentifiés (config probable pour que l'upload/download fonctionne), c'est une **IDOR complète sur l'ensemble des documents**, CNI et cartes vitales incluses. *Confiance : élevée sur l'absence de contrôle applicatif ; à confirmer sur la config Storage du dashboard.*

**S4 — Restriction CNI/carte vitale non appliquée (P1).**
La policy `documents_select_cv` limite CNI/carte vitale à `admin/direction/admissions`. Mais `listCandidateDocuments` (Drizzle, cf. S1) renvoie **tous** les documents y compris `cni` et `carte_vitale` à tout `requireAuth()`, sans filtre de rôle, exposant au passage les `storagePath` réutilisables via S3. Un `team_leader` ou `relations_entreprises` voit donc les pièces d'identité. *Confiance : élevée.*

**S5 — Refresh token Gmail en clair (P1).**
`profiles.google_refresh_token` est un `text` non chiffré. Ce token permet d'envoyer des mails au nom de l'utilisateur (`gmail.send`). Contraste net avec le NIR, lui chiffré AES-256-GCM (`src/lib/nir.ts`). En cas de fuite DB (backup, accès pooler), les tokens sont exploitables directement. Recommandé : chiffrer au repos avec la même primitive que le NIR. *Confiance : élevée.*

**S6/S7 — Dépendances vulnérables HIGH (P1).**
`npm audit --omit=dev` : `drizzle-orm <0.45.2` (injection SQL via identifiants mal échappés — l'ORM est central ici) et `nodemailer <=9.0.0` (injection commande SMTP, CRLF, contournement `disableFileAccess`). Plus 22 moderate (chaîne `@sentry`/`@opentelemetry`, `postcss`, `uuid`). Le correctif Drizzle est un breaking change à tester. *Confiance : élevée (audit outillé).*

**S8 — Données sensibles → API Anthropic (P1 RGPD).**
`runExtraction` envoie l'image/PDF de CNI et de carte vitale (donc **NIR = donnée sensible au sens RGPD**, identité complète) à l'API Anthropic (`claude-haiku`). C'est un transfert vers un sous-traitant hors UE. À encadrer : base légale, DPA Anthropic, mention au registre, information des personnes, minimisation (l'extraction carte vitale ne récupère que le NIR — OK — mais l'image entière est transmise). *Confiance : élevée sur le fait, à arbitrer par le DPO.*

**S9 — Effacement RGPD incomplet (P2).**
`permanentlyDeleteCandidate` supprime la ligne DB (et `task_links`) mais **ne supprime pas les objets Storage** (CV, CNI, carte vitale). Fichiers sensibles orphelins → non-conformité droit à l'effacement + rétention non maîtrisée. *Confiance : élevée.*

**S10 — Lint non fonctionnel (P2).**
`npm run lint` (`next lint`) échoue sur un prompt interactif « configure ESLint » : **aucune config ESLint projet** n'existe. Pas de garde statique (`no-floating-promises`, règles Next) en local ni en CI. *Confiance : élevée.*

**Points positifs relevés.** Chiffrement NIR AES-256-GCM avec IV aléatoire et authTag correct (`src/lib/nir.ts`). Sanitation d'en-têtes MIME contre l'injection CRLF dans `gmail-api.ts` (`sanitizeHeader`). Validation type/taille des uploads (20 Mo, whitelist MIME). Cron protégé par `CRON_SECRET` (bearer). State CSRF vérifié sur le callback Gmail. Contrôle domaine `@eda-rh.fr` + invitation côté trigger `handle_new_user`. NIR chargé server-side uniquement pour Ypareo (jamais dans le draft), masqué dans les logs.

---

## 3. Risques performance (P0/P1/P2)

| # | Sévérité | Risque | Preuve |
|---|----------|--------|--------|
| P1 | **P1** | Chargements de pipeline non paginés (kanban candidats/besoins chargent tout) | `candidats/actions.ts:25-42` |
| P2 | **P1** | `getUser()` (appel réseau Auth) sur quasiment chaque requête via middleware | `src/middleware.ts:28-30`, matcher `:48` |
| P3 | **P2** | Route `/trames-mail` lourde : 147 kB / 357 kB First Load (Tiptap non code-splitté) | build output |
| P4 | **P2** | Envoi d'emails matching en boucle séquentielle (`for` + `await` par email) | `matching/actions.ts:865+`, `mail/actions.ts:550` |
| P5 | **P2** | Extraction IA synchrone dans le flux d'upload (bloque la réponse) | `document-actions.ts:253` |
| P6 | **P3** | `revalidatePath` en cascade (6 chemins) à chaque delete candidat | `candidats/[id]/actions.ts:209-215` |

**P1 — Pipelines non paginés.** `loadPipelineCandidates` charge **tous** les candidats non supprimés (`orderBy firstName`), puis fait 2 requêtes agrégées (tasks, matchings) sur l'ensemble des IDs. Acceptable à faible volume, mais O(n) non borné : à quelques milliers de candidats la page kanban devient lente et lourde en payload server-action. Même schéma côté besoins. Prévoir pagination/virtualisation ou fenêtrage par statut. *Confiance : élevée.*

**P2 — `getUser()` sur chaque requête.** Le middleware appelle `supabase.auth.getUser()` (validation réseau du JWT auprès de GoTrue) pour presque toutes les routes (matcher large). Ajoute une latence réseau à chaque navigation/asset dynamique. Envisager `getSession()` (lecture cookie locale) pour le gating, en réservant `getUser()` aux points sensibles. *Confiance : moyenne (dépend du profil de charge réel).*

**P3 — Bundle `/trames-mail`.** 357 kB First Load JS (Tiptap starter-kit + extensions). Lazy-load l'éditeur (`next/dynamic`, `ssr:false`) pour ne pas pénaliser l'entrée sur la page. *Confiance : élevée (mesuré au build).*

**P4 — Emails en boucle séquentielle.** `sendMatchingEmails` fait un `for (const email of params.emails) { await sendGmailMessage(...) }`. Sur un envoi de masse, latence cumulée = N × RTT Gmail. Les fichiers sont bien préchargés en parallèle (`Promise.all`, bon point), mais l'envoi ne l'est pas. Batcher avec concurrence limitée. Risque secondaire : quotas Gmail API. *Confiance : élevée.*

**P5 — Extraction IA synchrone.** `uploadCandidateDocument` attend `runExtraction` (appel Anthropic + parsing PDF) avant de répondre. L'utilisateur subit plusieurs secondes de latence à l'upload. Externaliser en job asynchrone (statut `pending` → polling/notification), l'infra `extractionStatus` existe déjà. *Confiance : élevée.*

---

## 4. Preuves (fichiers / lignes clés)

- Connexion DB rôle propriétaire : `src/db/index.ts:5-10` + `.env.example:8`
- Absence de `FORCE ROW LEVEL SECURITY` : `supabase/migrations/*` (0 occurrence)
- Auth sans filtre actif : `src/lib/auth.ts:15-19`
- URLs signées chemin arbitraire : `src/app/(app)/candidats/[id]/document-actions.ts:82-87`, `.../annuaire/[id]/document-actions.ts:133-140`, `.../besoins/[id]/fre-actions.ts:52-59`
- CNI listée sans filtre rôle : `.../candidats/[id]/document-actions.ts:42-78`
- Token Gmail en clair : `src/db/schema/profiles.ts:18`, `src/app/auth/gmail/callback/route.ts:51-54`
- Extraction IA de CNI/carte vitale : `.../candidats/[id]/document-actions.ts:302-331, 351-432`
- Hard delete sans purge Storage : `.../candidats/[id]/actions.ts:220-255`
- Policies Storage `documents` absentes : seul `supabase/migrations/20260630_signature_photos_insert_policy.sql` existe
- Vulnérabilités : sortie `npm audit --omit=dev` (drizzle-orm, nodemailer HIGH)

---

## 5. Plan d'action priorisé avant déploiement

### Bloquants (P0 — à lever avant toute prod avec données réelles)
1. **Rétablir une défense en profondeur DB.** Deux options combinables :
   - (a) Créer un rôle applicatif dédié non-propriétaire + `GRANT` minimal + `FORCE ROW LEVEL SECURITY` sur les tables sensibles, et faire pointer `DATABASE_URL` dessus. La RLS devient alors réellement appliquée.
   - (b) À défaut, **traiter les server actions comme l'unique frontière de sécurité** et y ajouter systématiquement les contrôles de rôle manquants (voir 2 et 4). L'option (a) reste fortement recommandée.
2. **Filtrer `active`/`deleted_at` dans `getCurrentUser`** (rejet des profils inactifs) + invalider les sessions à la désactivation.
3. **Sécuriser les URLs signées** : ne jamais accepter un `storagePath` client brut. Résoudre le document par son `id` en base, vérifier l'appartenance (candidat/entreprise/besoin) **et** le rôle pour CNI/carte vitale, puis signer le chemin issu de la base.
4. **Ajouter les policies Storage du bucket `documents`** dans une migration versionnée (least privilege), au lieu de dépendre d'une config dashboard non tracée.

### Quick wins (P1)
5. `listCandidateDocuments` : filtrer CNI/carte vitale selon le rôle (aligner sur `documents_select_cv`).
6. Chiffrer `google_refresh_token` au repos (réutiliser `lib/nir.ts`).
7. `npm audit fix` ciblé + montée `drizzle-orm ≥ 0.45.2` et `nodemailer ≥ 9.0.3` (tester les breaking changes).
8. Configurer ESLint (`eslint.config.mjs` avec `eslint-config-next`) et brancher `lint` en CI.
9. Documenter/encadrer l'envoi à Anthropic (DPA, registre, information) — arbitrage DPO.

### Refactors structurants (P2)
10. Extraction IA en job asynchrone (découpler de l'upload).
11. Pagination/fenêtrage des pipelines kanban.
12. Purge Storage sur hard delete + procédure d'effacement RGPD.
13. Envoi d'emails matching parallélisé avec concurrence bornée.
14. Lazy-load Tiptap sur `/trames-mail` ; revoir `getUser` vs `getSession` en middleware.

### Tests/vérifications à ajouter
- Tests d'accès par rôle sur chaque server action sensible (matrice rôle × action).
- Test négatif : profil `active=false` → toutes les actions refusées.
- Test IDOR : URL signée demandée avec un `storagePath`/`id` d'un autre candidat → refus.
- Vérif effective de la RLS (requête directe avec un JWT de rôle faible).
- CI : `build` + `lint` + `npm audit` en gate.

### Ordre conseillé
1 → 2 → 3 → 4 (bloquants, même sprint) · puis 5–9 · puis 10–14.

---

## 6. Questions ouvertes (Produit / DPO / Infra)

1. **Infra/DBA :** confirmez le rôle exact de `DATABASE_URL` en prod. Est-ce le propriétaire des tables ? Peut-on introduire un rôle applicatif restreint + `FORCE RLS`, ou la RLS est-elle considérée comme hors périmètre applicatif ?
2. **Infra :** quelles sont les policies réelles du bucket Storage `documents` (dashboard) ? Le `select` est-il ouvert aux authentifiés ? (détermine la gravité réelle de S3.)
3. **DPO :** l'envoi de CNI / carte vitale / NIR à l'API Anthropic est-il couvert par une base légale, un DPA et une information des personnes ? Faut-il une alternative on-premise pour ces pièces ?
4. **DPO/Produit :** durée de rétention des documents et des `ypareo_logs`/`activity_events` (qui contiennent des données personnelles) ? Procédure d'effacement à la demande ?
5. **Produit :** le rôle `direction` doit-il réellement être exclu des uploads/suppressions de documents (comportement actuel `if (role === "direction") non autorisé`) alors qu'il a « accès métier complet » ? Cohérence à valider.
6. **Sécurité :** existe-t-il un mécanisme de révocation/rotation des refresh tokens Gmail et du `NIR_ENCRYPTION_KEY` ? Où sont stockés les secrets en prod (Vercel env, coffre) ?
7. **Infra :** `GMAIL_USER`/`GMAIL_APP_PASSWORD` (chemin nodemailer du cron) et `CRON_SECRET` ne sont pas dans `.env.example` — sont-ils documentés/provisionnés ?

---

*Note méthodologique : audit statique uniquement, sans exécution runtime ni accès au projet Supabase. Les findings dépendant de la configuration dashboard (policies Storage, rôle DB) sont explicitement marqués « à confirmer ». Le build a été exécuté (succès) ; le lint est non fonctionnel (config absente) ; `npm audit` a été exécuté.*

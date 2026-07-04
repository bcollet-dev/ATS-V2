# Audit performance et securite - ATS EDA Groupe

Date: 2026-07-02  
Perimetre: revue statique du code, migrations Supabase, configuration Next.js, dependances, build de production.  
Commandes executees: `npm run build`, `npm run lint`, `npm audit --omit=dev`, lecture ciblee des routes, server actions, schemas et migrations.

## Synthese executive

L'application est fonctionnelle et le build de production passe. Elle n'est cependant pas encore prete pour un deploiement serein sans une passe de durcissement. Les risques les plus forts ne sont pas des bugs isoles, mais un ecart structurel entre l'intention de securite Supabase/RLS et l'execution reelle par l'application Next.js.

Points bloquants avant production:

- Controle d'acces documents sensibles: CNI, carte vitale, donnees extraites et URLs signees ne reprennent pas correctement les restrictions de role cote application.
- RLS contournee par Drizzle: la majorite des lectures/ecritures passent par `DATABASE_URL`, donc les politiques Supabase ne protegent pas ces chemins serveur.
- Politique RLS `profiles_update_self` probablement trop permissive: risque d'escalade de role si l'API Supabase directe autorise les updates de `profiles`.
- Extraction IA activee en pratique a l'upload, en contradiction avec l'ADR RGPD, sans flag explicite de production.
- Dependances avec vulnerabilites connues en production: `drizzle-orm` et `nodemailer` remontent en high via `npm audit`.
- Cron digest fail-open si `CRON_SECRET` est absent et appele avec `Authorization: Bearer undefined`.

Performance: le build est correct pour un outil interne, mais plusieurs ecrans chargent des datasets entiers et `/trames-mail` est lourd. Le risque principal est une degradation progressive avec le volume de candidats/besoins/documents, plus que le temps de chargement initial aujourd'hui.

## Architecture observee

- Stack: Next.js 15 App Router, React 19, Supabase Auth/Storage, Drizzle ORM, Postgres, server actions.
- Auth globale: middleware Supabase sur toutes les routes hors assets et `/auth/*`.
- Donnees: acces Postgres via `src/db/index.ts` avec `DATABASE_URL` et `postgres(..., { prepare: false })`.
- RLS: migrations Supabase presentes, mais principalement utiles pour les acces directs Supabase, pas pour les requetes Drizzle serveur.
- Integrations sensibles: Gmail OAuth, Ypareo, Anthropic, stockage documents, NIR chiffre applicativement.

## Constats securite

### S1 - P0 - RLS non appliquee aux chemins Drizzle

Preuves:

- `src/db/index.ts:5-10` cree un client Postgres direct via `DATABASE_URL`.
- Les pages/actions lisent et ecrivent avec `db.select`, `db.update`, `db.delete`, pas avec un client Supabase user-scoped.
- Les politiques RLS dans `supabase/migrations/0002_rls.sql` expriment des restrictions de role, mais ces restrictions ne sont pas automatiquement appliquees aux requetes serveur Drizzle.

Impact:

- Les garanties RLS peuvent donner un faux sentiment de securite.
- Toute verification oubliee dans une server action devient un vrai trou applicatif.

Remediation:

- Considerer les server actions comme la frontiere de securite principale.
- Creer des helpers centralises: `requireActiveUser`, `requireAnyRole`, `canReadSensitiveDocument`, `canMutateTask`, `canDeleteEntity`.
- Filtrer les profils sur `active = true` et `deleted_at is null` dans `getCurrentUser`.
- Pour les flux tres sensibles, envisager un acces DB avec role applicatif non superuser et RLS forcee, ou des RPC Supabase `security definer` strictement auditees.

### S2 - P0 - Escalade possible via RLS `profiles_update_self`

Preuves:

- `supabase/migrations/0002_rls.sql:47-49` autorise `profiles_update_self` avec `using (id = auth.uid())`.
- Aucune restriction de colonne n'est visible dans la migration.
- `profiles` contient `role`, `active`, `google_refresh_token`, `email_signature`, etc.

Impact:

- Si le role `authenticated` a le droit SQL d'update la table via l'API Supabase, un utilisateur pourrait modifier son propre `role` en `admin`.
- Apres escalade, les politiques `current_user_role() = 'admin'` ouvrent le reste.

Remediation:

- Supprimer la policy self-update generale.
- Remplacer par des RPC ou policies limitees aux champs explicitement autorises.
- Verifier les grants effectifs en base.
- Ajouter un test RLS qui tente de modifier `profiles.role` avec un JWT utilisateur standard.

### S3 - P0 - Documents sensibles accessibles trop largement

Preuves:

- RLS declare une intention stricte: `documents_select_cv` limite `cni` et `carte_vitale` a `admin`, `direction`, `admissions` dans `supabase/migrations/0002_rls.sql:151-159`.
- `listCandidateDocuments` retourne tous les documents, dont `cni` et `carte_vitale`, avec `storagePath`: `src/app/(app)/candidats/[id]/document-actions.ts:42-77`.
- `getSignedCandidateDocumentUrl(storagePath)` signe directement un chemin sans verifier l'entite, le type document ou le role: `src/app/(app)/candidats/[id]/document-actions.ts:82-86`.
- `getDocumentExtraction(documentId)` retourne `extractedData` sans restriction de type/role: `src/app/(app)/candidats/[id]/document-actions.ts:91-97`.
- `CandidatPage` charge `listCandidateDocuments(id)` pour tout utilisateur authentifie: `src/app/(app)/candidats/[id]/page.tsx:68-114`.

Impact:

- Un utilisateur ATS non autorise peut voir que des documents sensibles existent et obtenir un lien signe si l'UI l'expose ou si l'action est appelee.
- Les donnees extraites d'une carte vitale peuvent contenir un NIR avant validation et chiffrement.

Remediation:

- Remplacer les URLs signees par une action `getSignedCandidateDocumentUrl(documentId)`.
- Recharger le document en base, verifier `candidateId`, `documentType` et role avant signature.
- Ne jamais renvoyer `storagePath` au client pour les documents sensibles.
- Filtrer `listCandidateDocuments` selon le role.
- Appliquer les memes controles a `getDocumentExtraction`, `retryDocumentExtraction`, `deleteCandidateDocument`.

### S4 - P0 - Extraction IA en contradiction avec l'ADR RGPD

Preuves:

- L'ADR `docs/adr/0005-extraction-ia-documents-rgpd.md` indique que l'extraction ne doit pas etre activee en production tant que les points DPO ne sont pas tranches.
- `uploadCandidateDocument` lance `runExtraction(...)` immediatement apres upload: `src/app/(app)/candidats/[id]/document-actions.ts:253`.
- `runExtraction` envoie images/PDF/texte a Anthropic: `src/app/(app)/candidats/[id]/document-actions.ts:351-455`.
- Les donnees extraites sont persistees en base dans `documents.extractedData`: `src/app/(app)/candidats/[id]/document-actions.ts:439-446`.
- `importFre` fait aussi une extraction LLM: `src/app/(app)/besoins/[id]/fre-actions.ts:334-394`.

Impact:

- Risque RGPD majeur: transfert de CV, CNI, carte vitale ou FRE a Anthropic sans decision DPO explicite.
- L'ADR affirme qu'aucune donnee extraite n'est persistee sans validation humaine, mais le code persiste le JSON extrait avant application.

Remediation:

- Introduire un flag explicite `AI_EXTRACTION_ENABLED=false` par defaut en production.
- Bloquer l'extraction des CNI/cartes vitales tant que le cadre DPO n'est pas valide.
- Journaliser consentement/base legale et version du traitement.
- Stocker les extractions sensibles temporairement ou les chiffrer, avec purge automatique.

### S5 - P1 - Server actions sans authentification explicite

Preuves:

- `createCandidat` et `createEntreprise` n'appellent pas `requireAuth`: `src/app/(app)/annuaire/create-actions.ts:20-99`.
- `searchAnnuaire` n'appelle pas `requireAuth`: `src/app/(app)/annuaire/actions.ts:41-142`.
- `lookupSiret` est public cote action: `src/app/(app)/annuaire/siret-actions.ts:19-55`.
- `createCursus` et `toggleCursusActive` n'appellent pas `requireAuth`: `src/app/(app)/cursus/actions.ts:242-270`.
- `markNotificationsRead(userId)` accepte un `userId` fourni par le client sans verifier l'utilisateur courant: `src/app/(app)/candidats/[id]/task-actions.ts:307-310`.
- `revalidateNeed` et `revalidateCandidat` n'appellent pas `requireAuth`: `src/app/(app)/matching/actions.ts:450-457`.

Impact:

- Dependance excessive au middleware et au routage Next.
- Surface d'appel plus fragile si une action est importee ailleurs ou si le modele server action evolue.

Remediation:

- Ajouter `requireAuth` au debut de chaque server action non publique.
- Pour `markNotificationsRead`, supprimer le parametre `userId` et utiliser `actor.id`.
- Ajouter un test automatisable qui scanne les fichiers `"use server"` et echoue si une action exportee n'appelle pas un garde d'auth.

### S6 - P1 - Operations destructives et metier avec roles trop larges

Preuves:

- Suppression/archivage candidat accessible a tout utilisateur authentifie: `src/app/(app)/candidats/[id]/actions.ts:178-255`.
- Suppression definitive besoin accessible a tout utilisateur authentifie: `src/app/(app)/besoins/actions.ts:294-318`.
- Suppression massive des matchings par besoin/candidat: `src/app/(app)/matching/actions.ts:428-448`.
- Update/delete de taches ne reprend pas la logique RLS `assigned_to or manager`: `src/app/(app)/taches/actions.ts:218-294`.

Impact:

- Un utilisateur non manager peut modifier ou supprimer des donnees structurantes.
- Incoherence avec les politiques RLS qui reservaient certains updates aux managers.

Remediation:

- Definir une matrice RBAC explicite par operation.
- Aligner code applicatif et RLS.
- Ajouter audit log pour les hard deletes et actions de masse.
- Exiger `admin` ou `direction` pour hard delete, et manager pour operations de pipeline sensibles.

### S7 - P1 - Cron digest fail-open si secret absent

Preuves:

- `src/app/api/cron/digest/route.ts:8-10` compare `auth` a `Bearer ${process.env.CRON_SECRET}`.
- `CRON_SECRET` n'est pas present dans `.env.example`.

Impact:

- Si `CRON_SECRET` n'est pas configure, `Authorization: Bearer undefined` peut autoriser l'appel.

Remediation:

- Fail closed: si `!process.env.CRON_SECRET`, retourner 500 ou 404.
- Ajouter `CRON_SECRET` a `.env.example`.
- Limiter la route au fournisseur de cron si possible.

### S8 - P1 - Refresh tokens Gmail stockes en clair

Preuves:

- `profiles.google_refresh_token` est un champ texte: `src/db/schema/profiles.ts:18`.
- Les callbacks OAuth ecrivent le refresh token directement: `src/app/auth/callback/route.ts:28-33`, `src/app/auth/gmail/callback/route.ts:48-54`.

Impact:

- Une fuite DB permet d'envoyer des emails via les comptes connectes.

Remediation:

- Chiffrer les refresh tokens applicativement comme le NIR.
- Ajouter rotation/revocation et procedure d'incident.
- Minimiser les scopes Google.

### S9 - P1 - HTML stocke et rendu sans sanitization explicite

Preuves:

- Les trames mail stockent `body` en HTML: `src/app/(app)/trames-mail/actions.ts:171-223`.
- Le preview read-only utilise `dangerouslySetInnerHTML`: `src/app/(app)/trames-mail/TrameDrawer.tsx:334-337`.
- L'editeur Tiptap accepte des liens arbitraires via `setLink({ href: url })`: `src/app/(app)/trames-mail/TiptapEditor.tsx:47-52`.

Impact:

- Risque de XSS stockee interne si un utilisateur avec droit edition introduit HTML/lien dangereux.
- Risque accru car les trames sont reenvoyees dans Gmail en HTML.

Remediation:

- Sanitizer serveur et client avec une allowlist HTML.
- Restreindre les protocoles de liens a `https:`, `mailto:`, `tel:`.
- Envisager un format structure Tiptap JSON plutot qu'un HTML libre.

### S10 - P1 - Dependances vulnerables

Resultat `npm audit --omit=dev`:

- 2 high, 22 moderate, 0 critical.
- `drizzle-orm@0.44.7`: advisory SQL injection via identifiers, fix indique vers `0.45.2`.
- `nodemailer@7.0.13`: plusieurs advisories, fix indique vers `9.0.3`.
- `@sentry/nextjs@9.47.1`: chaine OpenTelemetry moderee, fix indique vers `10.63.0`.
- `next@15.5.19`: audit remonte PostCSS embarque; a investiguer sans downgrade aveugle.

Remediation:

- Monter `drizzle-orm` et `drizzle-kit` de facon coordonnee, lancer build et smoke tests DB.
- Supprimer `nodemailer` si le digest SMTP legacy est abandonne, ou migrer vers une version corrigee.
- Evaluer upgrade Sentry ou desactivation temporaire des integrations OpenTelemetry non utilisees.
- Ajouter `npm audit --omit=dev --audit-level=high` en CI.

### S11 - P2 - Stockage Supabase pas entierement declaratif

Preuves:

- Les migrations ne declarent pas la creation des buckets `documents` et `signature-photos`.
- Seule une policy insert `signature-photos` est visible: `supabase/migrations/20260630_signature_photos_insert_policy.sql`.
- Aucune policy storage `documents` n'est versionnee.

Impact:

- Un environnement neuf peut ne pas fonctionner sans configuration manuelle.
- Les droits Storage peuvent diverger entre dev et prod.

Remediation:

- Versionner la creation des buckets et toutes les policies Storage.
- Documenter public/private, limite de taille, types MIME et duree des URLs signees.

### S12 - P2 - Profil inactif ou supprime encore accepte par l'app

Preuves:

- `getCurrentUser` recupere le profil par ID seulement: `src/lib/auth.ts:15-17`.
- Les helpers RLS, eux, exigent `active = true` et `deleted_at is null`.

Impact:

- Un profil desactive dans l'ATS peut rester utilisable tant que la session Supabase existe.

Remediation:

- Modifier `getCurrentUser` pour filtrer `active = true` et `deletedAt IS NULL`.
- Forcer sign-out ou revoke session quand un profil est desactive.

## Constats performance

### P1 - Chargements non pagines sur les grands ecrans metier

Preuves:

- `loadPipelineCandidates` charge tous les candidats non supprimes, puis taches et matchings associes: `src/app/(app)/candidats/actions.ts:25-118`.
- `loadPipelineNeeds` charge tous les besoins, puis plusieurs agregations: `src/app/(app)/besoins/actions.ts:115-260`.
- `loadCandidatesForMatching` et `loadNeedsForMatching` chargent de larges ensembles sans pagination: `src/app/(app)/matching/actions.ts:553-624`, `src/app/(app)/matching/actions.ts:1032-1127`.

Impact:

- Performance acceptable au debut, degradee avec la croissance.
- Temps serveur, taille JSON et cout de rendu client augmentent lineairement.

Remediation:

- Ajouter pagination/virtualisation ou segmentation par statut.
- Charger les details secondaires a la demande.
- Ajouter indexes composites/partiels alignes sur les filtres principaux.

### P2 - Bundle `/trames-mail` lourd

Build production:

- `/trames-mail`: 147 kB de route, 357 kB First Load JS.
- `/besoins`: 240 kB First Load JS.
- `/candidats`: 238 kB First Load JS.

Cause probable:

- Tiptap et UI riche importes directement dans l'ecran.

Remediation:

- Charger l'editeur Tiptap uniquement quand le drawer d'edition est ouvert.
- Separer liste des trames et edition riche.
- Surveiller les chunks avec bundle analyzer.

### P3 - Extraction et parsing documents synchrones

Preuves:

- Upload document lit le fichier complet en memoire: `file.arrayBuffer()` puis `Buffer.from(...)`.
- Parsing PDF/DOCX et appel Anthropic sont faits dans la meme action utilisateur.
- Limite actuelle: 20 Mo pour documents candidat et pieces jointes.

Impact:

- Risque de timeout, memoire elevee et UX lente.

Remediation:

- Upload rapide puis job asynchrone d'extraction.
- Queue avec statut, retry, timeout et limite de concurrence.
- Limite de taille plus stricte pour l'extraction IA que pour le stockage brut.

### P4 - Envoi email batch charge toutes les pieces jointes en memoire

Preuves:

- `sendMatchingEmails` telecharge les CVs en parallele et les garde dans `fileCache`: `src/app/(app)/matching/actions.ts:807-829`.
- `sendEntityMail` charge les pieces jointes en `Buffer`: `src/app/(app)/mail/actions.ts:524-559`.

Impact:

- Gros batch = memoire elevee et risque de timeout.

Remediation:

- Limiter nombre de mails et taille totale par batch.
- Envoyer en job asynchrone avec backpressure.
- Controler que les documents joints appartiennent bien aux candidats/besoins selectionnes.

### P5 - Cron digest N+1

Preuves:

- Le cron charge tous les profils actifs, puis fait une requete de taches par profil: `src/app/api/cron/digest/route.ts:13-50`.

Impact:

- Acceptable avec peu d'utilisateurs, couteux avec croissance.

Remediation:

- Charger toutes les taches ouvertes en une requete groupee.
- Envoyer avec limite de concurrence.

### P6 - Middleware lourd et warning Edge Runtime

Build:

- Middleware: 88.4 kB.
- Warning: `@supabase/supabase-js` utilise `process.version`, non supporte Edge Runtime.

Impact:

- Non bloquant si tout fonctionne, mais a surveiller sur Vercel/Edge.

Remediation:

- Verifier que seul `@supabase/ssr` serveur est necessaire dans middleware.
- Tester en environnement cible.

### P7 - Lint non pret CI

Preuve:

- `npm run lint` lance une configuration interactive `next lint`, depreciee et bloquante.

Impact:

- Pas de garde qualite automatisable.

Remediation:

- Migrer vers ESLint CLI non interactif.
- Ajouter typecheck/lint/audit en CI.

## Priorites recommandees

### Avant toute mise en production

1. Corriger `getCurrentUser` pour refuser profils inactifs/supprimes.
2. Verrouiller les policies `profiles`, surtout `profiles_update_self`.
3. Centraliser les guards RBAC cote server actions.
4. Refaire l'acces documents: signer par document ID, filtrer par role, ne pas exposer `storagePath` sensible.
5. Desactiver extraction IA par defaut en prod et aligner code/ADR RGPD.
6. Corriger `CRON_SECRET` fail-closed et documenter les variables d'environnement.
7. Upgrader ou retirer `drizzle-orm`/`nodemailer` vulnerables.
8. Rendre le lint non interactif.

### Juste apres durcissement securite

1. Pagination/virtualisation des pipelines candidats, besoins et matching.
2. Lazy-load de Tiptap sur `/trames-mail`.
3. Jobs asynchrones pour extraction documents, envoi email batch et digest.
4. Policies Storage versionnees et testees.
5. Tests d'autorisation par role pour documents, suppression, matching, taches.

## Questions a trancher

- Quels roles doivent pouvoir lire CNI, carte vitale, NIR extrait, FRE et pieces jointes entreprise?
- Les utilisateurs `relations_entreprises` peuvent-ils supprimer, archiver ou modifier tous les candidats/besoins?
- L'extraction IA est-elle autorisee en production? Si oui, avec quelle base legale, quelle information candidat, quelle retention?
- Les emails doivent-ils continuer via Gmail OAuth personnel ou passer par un service transactionnel centralise?
- Le stockage des documents doit-il appliquer une duree de retention differente par type?

## Verdict

Go build: oui.  
Go production: non, pas sans corriger les P0 et P1 securite.  
Go pilote interne limite: possible uniquement si extraction IA est desactivee, acces documents restreint, roles verrouilles, secrets verifies et audit dependances traite.

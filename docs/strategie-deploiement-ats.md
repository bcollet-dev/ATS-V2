# Strategie de deploiement ATS V2 - synthese Codex + Claude

Date: 2026-07-02  
Source: audit Codex `docs/audit-performance-securite-ats.md`, audit Claude `docs/audit-independant-claude-ats.md`, retour croise `docs/comparaison-audits-claude-codex.md`.

## Verdict consolide

Go build: oui.  
Go production: non.  
Go pilote avec donnees reelles: non tant que les blocages securite ci-dessous ne sont pas corriges.  
Go pilote technique avec donnees fictives: possible.

Les deux audits convergent fortement: le risque racine est l'ecart entre les politiques RLS Supabase et les acces reels par Drizzle cote serveur. En pratique, l'application doit etre durcie comme si les server actions etaient la frontiere principale de securite.

## Decision immediate

On classe les chantiers en trois cercles:

1. **Blocants prod**: a corriger avant toute donnee reelle.
2. **Durcissement court terme**: a faire avant pilote elargi.
3. **Performance et industrialisation**: a planifier apres verrouillage securite.

Le point "profils inactifs" est remonte en P0 dans cette synthese, comme recommande par Claude: c'est un contournement d'offboarding.

## Lot 0 - Decisions a prendre avant code

Ces decisions doivent etre tranchees avant de coder les changements sensibles.

| Sujet | Decision attendue | Responsable |
|---|---|---|
| Matrice RBAC | Qui peut lire CNI, carte vitale, NIR, FRE, pieces entreprise, supprimer/archiver candidats/besoins/matchings | Produit + direction |
| IA documentaire | Extraction Anthropic autorisee en prod ou non, types de documents autorises, consentement/information candidat | DPO + produit |
| Role DB applicatif | Garder Drizzle comme frontiere applicative seule ou creer un role DB restreint avec RLS forcee | Infra/DBA |
| Storage Supabase | Buckets prives/publics, policies `documents`, duree URLs signees, retention | Infra + DPO |
| Email | Gmail OAuth personnel ou service transactionnel centralise | Produit + infra |

## Lot 1 - Blocants avant production

Objectif: supprimer les chemins d'acces non autorises aux donnees sensibles et verrouiller l'offboarding.

### 1. Refuser les profils inactifs/supprimes

Pourquoi: un utilisateur desactive peut garder l'acces tant que sa session Supabase existe.

Actions:

- Modifier `getCurrentUser` pour filtrer `active = true` et `deletedAt IS NULL`.
- Faire en sorte que `requireAuth` s'appuie sur ce profil actif.
- Prevoir une invalidation/revocation de session lors de la desactivation d'un profil.
- Ajouter un test negatif: profil `active=false` -> aucune action sensible autorisee.

Critere de sortie:

- Un profil inactif ne peut plus acceder a une page app ni executer une server action.

### 2. Verrouiller `profiles_update_self`

Pourquoi: la policy RLS actuelle peut permettre a un utilisateur de modifier son propre role via l'API Supabase REST si les grants le permettent.

Actions:

- Verifier les grants effectifs du role `authenticated` sur `profiles`.
- Supprimer ou restreindre la policy self-update generale.
- Remplacer par une RPC ou policy limitee aux champs autorises, par exemple nom/signature, jamais `role`, `active`, `deleted_at`, `google_refresh_token`.
- Ajouter un test RLS direct tentant `UPDATE profiles SET role = 'admin'`.

Critere de sortie:

- Un utilisateur standard ne peut pas modifier son role, son statut actif, ni ses tokens.

### 3. Centraliser les gardes RBAC des server actions

Pourquoi: plusieurs server actions n'ont pas de garde explicite, et certaines operations destructives sont trop larges.

Actions:

- Creer des helpers lisibles:
  - `requireActiveUser`
  - `requireAnyRole`
  - `requireManager`
  - `canReadSensitiveDocument`
  - `canMutateTask`
  - `canDeleteEntity`
- Ajouter un garde explicite a toutes les server actions non publiques.
- Corriger en priorite:
  - `createCandidat`, `createEntreprise`
  - `searchAnnuaire`
  - `createCursus`, `toggleCursusActive`
  - `markNotificationsRead(userId)` -> utiliser l'utilisateur courant, pas un ID fourni
  - `deleteCandidate`, `permanentlyDeleteCandidate`
  - `permanentlyDeleteNeed`
  - `deleteAllMatchingsForNeed`, `deleteAllMatchingsForCandidate`
  - update/delete de taches

Critere de sortie:

- Une matrice role x action est appliquee dans le code.
- Un scan statique echoue si une server action exportee n'a aucun garde d'auth.

### 4. Refaire l'acces documents

Pourquoi: les URLs signees sont creees a partir d'un `storagePath` fourni par le client, sans controle de role/document.

Actions:

- Remplacer les appels par document ID, pas par `storagePath`.
- Recharger le document en base cote serveur.
- Verifier:
  - l'entite rattachee;
  - le type de document;
  - le role;
  - l'etat non supprime de l'entite.
- Ne pas renvoyer `storagePath` au client pour les documents sensibles.
- Filtrer `listCandidateDocuments` selon le role.
- Appliquer la meme logique a:
  - URL signee candidat;
  - URL signee entreprise;
  - URL signee FRE;
  - donnees extraites;
  - retry extraction;
  - suppression document.

Critere de sortie:

- Un utilisateur non autorise ne voit ni ne telecharge CNI, carte vitale, NIR extrait ou document hors perimetre.

### 5. Mettre l'extraction IA en conformite avec l'ADR

Pourquoi: le code extrait automatiquement a l'upload et persiste les donnees extraites avant validation, en contradiction avec l'ADR RGPD.

Actions:

- Ajouter `AI_EXTRACTION_ENABLED=false` par defaut en production.
- Rendre l'extraction manuelle, jamais automatique a l'upload.
- Ne pas persister de donnees sensibles extraites sans validation humaine, ou les stocker temporairement/chiffrees avec purge courte.
- Bloquer CNI/carte vitale tant que le DPO n'a pas valide le cadre.
- Documenter base legale, DPA Anthropic, information candidat, retention.

Critere de sortie:

- Aucune CNI/carte vitale/FRE/CV n'est envoyee a Anthropic sans decision produit/DPO explicite.

### 6. Corriger le cron digest fail-closed

Pourquoi: sans `CRON_SECRET`, `Authorization: Bearer undefined` peut passer.

Actions:

- Si `CRON_SECRET` est absent: refuser systematiquement.
- Ajouter `CRON_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD` a `.env.example` ou retirer le chemin SMTP legacy.
- Ajouter une verification de configuration au demarrage/deploiement.

Critere de sortie:

- Le cron est impossible a appeler sans secret configure.

### 7. Versionner les policies Storage `documents`

Pourquoi: la securite des documents depend possiblement d'une configuration dashboard non versionnee.

Actions:

- Declarer les buckets en migration.
- Declarer les policies `storage.objects` pour `documents`.
- Verifier upload/download par role.
- Documenter taille, types MIME, duree URL signee.

Critere de sortie:

- Un environnement neuf reproduit les droits Storage sans manipulation manuelle.

## Lot 2 - Durcissement court terme

Objectif: reduire l'impact d'une fuite DB, fermer les vecteurs secondaires et rendre la qualite verifiable.

### 8. Chiffrer les refresh tokens Gmail

- Reutiliser le modele AES-256-GCM du NIR ou creer un helper generique de chiffrement applicatif.
- Prevoir rotation et revocation.
- Ajouter une migration des tokens existants.

### 9. Sanitizer les trames mail HTML

- Sanitizer serveur avant stockage et/ou avant rendu.
- Restreindre les liens a `https:`, `mailto:`, `tel:`.
- Verifier `dangerouslySetInnerHTML`.

### 10. Traiter les vulnerabilites dependencies

- Monter `drizzle-orm >= 0.45.2` avec tests DB.
- Supprimer `nodemailer` si le digest SMTP legacy est abandonne, sinon monter vers une version corrigee.
- Evaluer l'upgrade Sentry/OpenTelemetry.
- Ajouter `npm audit --omit=dev --audit-level=high` en CI.

### 11. Restaurer un lint non interactif

- Migrer `next lint` vers ESLint CLI.
- Ajouter `build`, `lint`, `typecheck`, `audit high` en gate CI.

### 12. Purger Storage au hard delete

- Avant suppression definitive candidat/besoin/entreprise, lister les documents rattaches.
- Supprimer les objets Storage.
- Journaliser l'effacement.
- Ajouter une strategie retention par type de document.

## Lot 3 - Performance et industrialisation

Objectif: eviter que l'outil ralentisse avec la croissance.

### 13. Pagination ou virtualisation des pipelines

Ecrans concernes:

- candidats;
- besoins;
- matching;
- annuaire selon volume.

Approche:

- Filtrer par statut et proprietaire.
- Charger les details secondaires a la demande.
- Ajouter indexes composites/partiels si les requetes le justifient.

### 14. Jobs asynchrones

Flux a sortir de la requete utilisateur:

- extraction PDF/DOCX/IA;
- emails batch;
- digest quotidien.

Critere:

- upload rapide;
- statut visible;
- retry;
- limite de concurrence;
- timeout maitrise.

### 15. Allegement front

- Lazy-load Tiptap sur `/trames-mail`.
- Mesurer avec bundle analyzer.
- Garder un seuil de First Load JS pour les pages internes lourdes.

### 16. Middleware et session

- Evaluer `getSession` pour le gating de navigation.
- Garder `getUser`/validation forte aux actions sensibles.
- Tester le warning Edge Runtime sur la cible de deploiement.

## Ordre recommande

### Sprint securite 1 - avant toute donnee reelle

1. `getCurrentUser` actif/non supprime.
2. `profiles_update_self`.
3. Gardes RBAC centralises.
4. Documents par ID + controle role.
5. Extraction IA desactivee par defaut.
6. Cron fail-closed.
7. Policies Storage.

### Sprint securite 2 - avant pilote elargi

1. Tokens Gmail chiffres.
2. Sanitization HTML.
3. Dependencies high corrigees.
4. Lint/CI.
5. Purge Storage hard delete.
6. Tests role/action/IDOR/RLS.

### Sprint performance

1. Pagination pipelines.
2. Jobs asynchrones.
3. Email batch avec concurrence limitee.
4. Lazy-load Tiptap.
5. Optimisation middleware.

## Criteres de go pilote avec donnees reelles

Le pilote ne demarre que si:

- aucun profil inactif ne peut acceder a l'application;
- un utilisateur non autorise ne peut pas lister, signer ou telecharger CNI/carte vitale/NIR extrait;
- l'escalade `profiles.role` via API Supabase est impossible;
- toutes les server actions sensibles ont un garde d'auth/role;
- l'extraction IA est desactivee ou formellement validee par DPO;
- les secrets critiques sont presents et fail-closed;
- les vulnerabilities high `npm audit --omit=dev` sont traitees ou justifiees;
- `build` et `lint` non interactif passent.

## Position finale

Les audits sont compatibles et se renforcent. La strategie retenue doit privilegier un sprint de durcissement court et tres cible avant toute optimisation lourde. La performance peut attendre quelques jours; les documents sensibles, les roles et l'offboarding ne doivent pas attendre.

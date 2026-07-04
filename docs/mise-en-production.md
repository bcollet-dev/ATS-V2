# Mise en production ATS V2

Date de preparation: 2026-07-04

## Verdict

L'application est prete pour une mise en production controlee apres configuration des secrets, application des migrations Supabase et validation finale.

Commandes de controle local:

```bash
npm run validate:prod
```

Cette commande verifie les variables obligatoires, le lint, le typage, les tests, le build et l'audit production.

## Variables de production

A renseigner dans Vercel, environnement `Production`.

Obligatoires:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
APP_ENCRYPTION_KEY
NIR_ENCRYPTION_KEY
YPAREO_BASE_URL
YPAREO_IDENTIFICATION_TOKEN
YPAREO_PLACEMENT_PATH
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
ANTHROPIC_API_KEY
AI_EXTRACTION_ENABLED=true
AI_EXTRACTION_DPO_APPROVED=true
CRON_SECRET
GMAIL_USER
GMAIL_APP_PASSWORD
```

Recommande:

```text
NEXT_PUBLIC_SENTRY_DSN
```

L'extraction IA automatique est prevue pour ce lancement. Elle reste encadree: les champs extraits sont proposes a l'import avec cases cochables/decochables, et aucune donnee metier definitive n'est ecrite sans validation humaine.

Contraintes:

- `APP_ENCRYPTION_KEY`: 64 caracteres hexadecimaux, utilisee pour les secrets applicatifs comme les tokens Gmail.
- `NIR_ENCRYPTION_KEY`: 64 caracteres hexadecimaux, a conserver definitivement.
- `CRON_SECRET`: valeur aleatoire longue, minimum 32 caracteres.
- `DATABASE_URL`: pooler transaction Supabase, port `6543`.
- `YPAREO_PLACEMENT_PATH`: chemin API commencant par `/`.
- `AI_EXTRACTION_ENABLED`: doit valoir `true` pour ce lancement.
- `AI_EXTRACTION_DPO_APPROVED`: doit valoir `true` avant activation production.
- `DIRECT_URL`: utile localement pour les migrations Drizzle, pas necessaire au runtime Vercel.
- Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` cote navigateur.

## Supabase

1. Creer ou selectionner le projet Supabase de production.
2. Activer Auth Google dans Supabase si la connexion Google est utilisee.
3. Appliquer toutes les migrations SQL du dossier `supabase/migrations`.
4. Verifier que les migrations `20260703_security_hardening_profiles.sql`, `20260703_storage_buckets.sql` et `20260704_performance_indexes.sql` sont appliquees.
5. Creer le premier utilisateur autorise dans `allowed_emails` ou `profiles` selon le flux d'invitation retenu.
6. Verifier que les tables exposees au Data API ont RLS activee et les grants attendus.

Si Supabase CLI est installee:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Sinon, appliquer les fichiers SQL dans l'ordre depuis l'editeur SQL Supabase.

## Vercel

1. Lier le projet:

```bash
npx vercel link
```

2. Ajouter les variables d'environnement dans Vercel.
3. Recuperer les variables localement pour verification:

```bash
npx vercel env pull .env.production.local --environment=production --yes
npm run validate:prod
npm run perf:smoke
```

4. Creer un preview deploy:

```bash
npx vercel deploy
```

5. Tester le preview avec donnees controlees.
6. Promouvoir en production:

```bash
npx vercel promote <preview-url>
```

ou deployer directement:

```bash
npx vercel deploy --prod
```

Le fichier `vercel.json` configure le cron quotidien `/api/cron/digest` a 06:00 UTC.

## Verification post-deploiement

Apres mise en ligne:

- Ouvrir `/login`.
- Se connecter avec un compte autorise.
- Verifier les pipelines candidats et besoins.
- Generer une FRE sur un besoin en statut Attente FRE.
- Ouvrir une FRE dans un nouvel onglet.
- Importer un document test et verifier que l'extraction IA propose les champs avec cases decochables.
- Verifier un envoi Ypareo sur un dossier test.
- Verifier qu'une erreur Ypareo remet bien le candidat et le besoin en Attente FRE.
- Verifier upload/ouverture/suppression document candidat et entreprise.
- Verifier qu'un profil desactive ne peut plus acceder.
- Verifier le cron avec un appel portant `Authorization: Bearer <CRON_SECRET>`.
- Consulter les logs Vercel pendant au moins 30 minutes.

## Rollback

En cas de probleme applicatif:

```bash
npx vercel rollback
```

En cas de probleme base de donnees:

- ne pas modifier manuellement des donnees critiques sans sauvegarde;
- exporter les tables touchees;
- appliquer une migration corrective explicite;
- documenter l'incident dans `docs/adr/` si le comportement metier change.

## Points de surveillance

- Lint: 0 erreur, quelques avertissements non bloquants.
- Audit production: 0 vulnerabilite attendue.
- L'extraction IA est activee seulement si `AI_EXTRACTION_ENABLED=true`, `ANTHROPIC_API_KEY` et `AI_EXTRACTION_DPO_APPROVED=true` sont presents.
- Les documents Storage sont manipules cote serveur avec la cle service role apres controles metier applicatifs.

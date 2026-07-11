-- Durcissement sécurité (advisors Supabase) — déjà appliqué en production le 2026-07-11.
-- 1. RLS activée sur bug_reports et need_cursus (étaient exposées à la clé anon)
-- 2. Politiques « toujours vraies » remplacées par is_ats_user()
-- 3. search_path figé sur les fonctions trigger

ALTER TABLE "bug_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "need_cursus" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "bug_reports_select" ON "bug_reports"
    FOR SELECT TO authenticated
    USING (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "bug_reports_insert" ON "bug_reports"
    FOR INSERT TO authenticated
    WITH CHECK (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "bug_reports_update" ON "bug_reports"
    FOR UPDATE TO authenticated
    USING (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "bug_reports_delete" ON "bug_reports"
    FOR DELETE TO authenticated
    USING (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "need_cursus_select" ON "need_cursus"
    FOR SELECT TO authenticated
    USING (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "need_cursus_insert" ON "need_cursus"
    FOR INSERT TO authenticated
    WITH CHECK (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "need_cursus_update" ON "need_cursus"
    FOR UPDATE TO authenticated
    USING (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "need_cursus_delete" ON "need_cursus"
    FOR DELETE TO authenticated
    USING (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DROP POLICY IF EXISTS "candidate_experiences_authenticated" ON "candidate_experiences";--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY "candidate_experiences_all" ON "candidate_experiences"
    FOR ALL TO authenticated
    USING (is_ats_user())
    WITH CHECK (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DROP POLICY IF EXISTS "candidate_formations_authenticated" ON "candidate_formations";--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY "candidate_formations_all" ON "candidate_formations"
    FOR ALL TO authenticated
    USING (is_ats_user())
    WITH CHECK (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DROP POLICY IF EXISTS "candidate_skills_authenticated" ON "candidate_skills";--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY "candidate_skills_all" ON "candidate_skills"
    FOR ALL TO authenticated
    USING (is_ats_user())
    WITH CHECK (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DROP POLICY IF EXISTS "notifications_insert" ON "notifications";--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY "notifications_insert" ON "notifications"
    FOR INSERT TO authenticated
    WITH CHECK (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

ALTER FUNCTION public.set_updated_at() SET search_path = public;--> statement-breakpoint
ALTER FUNCTION public.derive_candidate_status() SET search_path = public;--> statement-breakpoint
ALTER FUNCTION public.derive_need_status() SET search_path = public;--> statement-breakpoint

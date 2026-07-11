-- Première itération (interview_grids) remplacée avant toute mise en production :
-- on repart proprement sur interview_trames + interviews.
DROP TABLE IF EXISTS "interviews";--> statement-breakpoint
DROP TABLE IF EXISTS "interview_grids";--> statement-breakpoint

DO $$
BEGIN
  CREATE TYPE "public"."interview_status" AS ENUM('draft', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "interview_trames" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "subcategory" text NOT NULL,
  "cursus_id" uuid,
  "questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "interviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "candidate_id" uuid NOT NULL,
  "trame_id" uuid,
  "trame_name" text NOT NULL,
  "subcategory" text NOT NULL,
  "cursus_name" text,
  "questions_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "overall_notes" text,
  "decision" text,
  "refusal_reason" text,
  "status" "public"."interview_status" DEFAULT 'draft' NOT NULL,
  "ai_summary" text,
  "ai_summary_generated_at" timestamp with time zone,
  "task_id" uuid,
  "conducted_by" uuid,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "interview_trames" ADD CONSTRAINT "interview_trames_cursus_id_cursus_id_fk"
    FOREIGN KEY ("cursus_id") REFERENCES "public"."cursus"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "interview_trames" ADD CONSTRAINT "interview_trames_created_by_profiles_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "interviews" ADD CONSTRAINT "interviews_candidate_id_candidates_id_fk"
    FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "interviews" ADD CONSTRAINT "interviews_trame_id_interview_trames_id_fk"
    FOREIGN KEY ("trame_id") REFERENCES "public"."interview_trames"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "interviews" ADD CONSTRAINT "interviews_task_id_tasks_id_fk"
    FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "interviews" ADD CONSTRAINT "interviews_conducted_by_profiles_id_fk"
    FOREIGN KEY ("conducted_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "interview_trames_cursus_idx" ON "interview_trames" USING btree ("cursus_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interview_trames_subcategory_idx" ON "interview_trames" USING btree ("subcategory");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interviews_candidate_idx" ON "interviews" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interviews_status_idx" ON "interviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interviews_completed_at_idx" ON "interviews" USING btree ("completed_at");--> statement-breakpoint

ALTER TABLE "interview_trames" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "interview_trames_select" ON "interview_trames"
    FOR SELECT TO authenticated
    USING (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "interview_trames_insert" ON "interview_trames"
    FOR INSERT TO authenticated
    WITH CHECK (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "interview_trames_update" ON "interview_trames"
    FOR UPDATE TO authenticated
    USING (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "interview_trames_delete" ON "interview_trames"
    FOR DELETE TO authenticated
    USING (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "interviews_select" ON "interviews"
    FOR SELECT TO authenticated
    USING (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "interviews_insert" ON "interviews"
    FOR INSERT TO authenticated
    WITH CHECK (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "interviews_update" ON "interviews"
    FOR UPDATE TO authenticated
    USING (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "interviews_delete" ON "interviews"
    FOR DELETE TO authenticated
    USING (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

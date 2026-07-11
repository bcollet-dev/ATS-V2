DO $$
BEGIN
  CREATE TYPE "public"."interview_status" AS ENUM('draft', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "interview_grids" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cursus_id" uuid NOT NULL,
  "questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "interview_grids_cursus_unique" UNIQUE("cursus_id")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "interviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "candidate_id" uuid NOT NULL,
  "grid_id" uuid,
  "cursus_name" text,
  "grid_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "overall_notes" text,
  "recommendation" text,
  "status" "public"."interview_status" DEFAULT 'draft' NOT NULL,
  "ai_summary" text,
  "ai_summary_generated_at" timestamp with time zone,
  "conducted_by" uuid,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "interview_grids" ADD CONSTRAINT "interview_grids_cursus_id_cursus_id_fk"
    FOREIGN KEY ("cursus_id") REFERENCES "public"."cursus"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "interview_grids" ADD CONSTRAINT "interview_grids_created_by_profiles_id_fk"
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
  ALTER TABLE "interviews" ADD CONSTRAINT "interviews_grid_id_interview_grids_id_fk"
    FOREIGN KEY ("grid_id") REFERENCES "public"."interview_grids"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "interviews" ADD CONSTRAINT "interviews_conducted_by_profiles_id_fk"
    FOREIGN KEY ("conducted_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "interviews_candidate_idx" ON "interviews" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interviews_status_idx" ON "interviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interviews_completed_at_idx" ON "interviews" USING btree ("completed_at");--> statement-breakpoint

ALTER TABLE "interview_grids" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "interview_grids_select" ON "interview_grids"
    FOR SELECT TO authenticated
    USING (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "interview_grids_insert" ON "interview_grids"
    FOR INSERT TO authenticated
    WITH CHECK (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "interview_grids_update" ON "interview_grids"
    FOR UPDATE TO authenticated
    USING (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "interview_grids_delete" ON "interview_grids"
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

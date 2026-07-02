DO $$
BEGIN
  CREATE TYPE "public"."task_link_entity_type" AS ENUM('candidate', 'company');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_one_entity_check";--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "task_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL,
  "entity_type" "public"."task_link_entity_type" NOT NULL,
  "entity_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "task_links" ADD CONSTRAINT "task_links_task_id_tasks_id_fk"
    FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "task_links_unique_idx" ON "task_links" USING btree ("task_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_links_task_idx" ON "task_links" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_links_entity_idx" ON "task_links" USING btree ("entity_type","entity_id");--> statement-breakpoint

ALTER TABLE "task_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "task_links_select" ON "task_links"
    FOR SELECT TO authenticated
    USING (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "task_links_insert" ON "task_links"
    FOR INSERT TO authenticated
    WITH CHECK (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "task_links_update" ON "task_links"
    FOR UPDATE TO authenticated
    USING (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  CREATE POLICY "task_links_delete" ON "task_links"
    FOR DELETE TO authenticated
    USING (is_ats_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE TYPE "public"."app_role" AS ENUM('admin', 'direction', 'team_leader', 'admissions', 'relations_entreprises');--> statement-breakpoint
CREATE TYPE "public"."candidate_status" AS ENUM('to_call', 'in_progress', 'no_response', 'interview', 'pvpp', 'admissible', 'company_interview', 'waiting_fre', 'placed', 'temporary_refusal', 'definitive_refusal', 'contract_break');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('cv', 'cni', 'carte_vitale', 'fre', 'diplome', 'other');--> statement-breakpoint
CREATE TYPE "public"."mail_audience" AS ENUM('candidate', 'company', 'need', 'all');--> statement-breakpoint
CREATE TYPE "public"."need_status" AS ENUM('ad_chase', 'prospect', 'need_in_progress', 'interview', 'waiting_fre', 'client', 'rupture');--> statement-breakpoint
CREATE TYPE "public"."proposition_status" AS ENUM('cv_sent', 'interview', 'waiting_fre', 'placed', 'not_retained');--> statement-breakpoint
CREATE TYPE "public"."task_category" AS ENUM('call', 'video_interview', 'onsite_interview', 'follow_up', 'document', 'email', 'administrative', 'other');--> statement-breakpoint
CREATE TYPE "public"."ypareo_exchange_status" AS ENUM('success', 'error', 'pending', 'retryable', 'not_retryable');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"role" "app_role" DEFAULT 'admissions' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"birth_name" text,
	"email" text,
	"phone" text,
	"address_line1" text,
	"address_line2" text,
	"postal_code" text,
	"city" text,
	"birth_date" date,
	"birth_city" text,
	"birth_country" text,
	"nir_encrypted" "bytea",
	"nir_iv" "bytea",
	"rqth" boolean DEFAULT false NOT NULL,
	"previous_situation_level" text,
	"skills" text[],
	"professional_experiences" text,
	"previous_trainings" text,
	"source" text,
	"owner_id" uuid,
	"next_action_at" timestamp with time zone,
	"lost_reason" text,
	"notes" text,
	"status" "candidate_status" DEFAULT 'to_call' NOT NULL,
	"ypareo_person_id" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"siret" text,
	"siren" text,
	"naf_code" text,
	"legal_form" text,
	"employee_range" text,
	"administrative_status" text,
	"address" text,
	"postal_code" text,
	"city" text,
	"sector" text,
	"website" text,
	"public_registry_data" jsonb,
	"registry_synced_at" timestamp with time zone,
	"owner_id" uuid,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "companies_siret_unique" UNIQUE("siret"),
	CONSTRAINT "companies_siren_unique" UNIQUE("siren")
);
--> statement-breakpoint
CREATE TABLE "company_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"job_title" text,
	"email" text,
	"phone" text,
	"is_primary" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cursus_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"site" text,
	"start_date" date,
	"end_date" date,
	"active" boolean DEFAULT true NOT NULL,
	"raw_data" jsonb,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classes_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "cursus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"raw_data" jsonb,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cursus_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "ypareo_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"correlation_id" uuid NOT NULL,
	"candidate_id" uuid,
	"company_id" uuid,
	"operation" text NOT NULL,
	"endpoint" text NOT NULL,
	"method" text NOT NULL,
	"request_payload" jsonb,
	"response_status" integer,
	"response_payload" jsonb,
	"status" "ypareo_exchange_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"retryable" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "needs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"contact_id" uuid,
	"title" text NOT NULL,
	"missions" text,
	"requirements" text,
	"target_cursus_id" uuid,
	"city" text,
	"start_date" date,
	"positions_count" integer DEFAULT 1 NOT NULL,
	"status" "need_status" DEFAULT 'ad_chase' NOT NULL,
	"owner_id" uuid,
	"lost_reason" text,
	"notes" text,
	"ypareo_need_id" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "needs_positions_count_check" CHECK ("needs"."positions_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "matchings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"need_id" uuid NOT NULL,
	"proposition_status" "proposition_status" DEFAULT 'cv_sent' NOT NULL,
	"is_winner" boolean DEFAULT false NOT NULL,
	"is_frozen" boolean DEFAULT false NOT NULL,
	"refusal_reason" text,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matchings_candidate_need_unique" UNIQUE("candidate_id","need_id")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid,
	"company_id" uuid,
	"need_id" uuid,
	"document_type" "document_type" NOT NULL,
	"file_name" text NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"extraction_status" text DEFAULT 'pending',
	"extracted_data" jsonb,
	"extracted_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_storage_path_unique" UNIQUE("storage_path"),
	CONSTRAINT "documents_one_entity_check" CHECK (num_nonnulls("documents"."candidate_id", "documents"."company_id", "documents"."need_id") = 1),
	CONSTRAINT "documents_file_size_check" CHECK ("documents"."file_size" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid,
	"company_id" uuid,
	"need_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"category" "task_category" DEFAULT 'follow_up' NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"assigned_to" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tasks_one_entity_check" CHECK (num_nonnulls("tasks"."candidate_id", "tasks"."company_id", "tasks"."need_id") >= 1)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"read_at" timestamp with time zone,
	"candidate_id" uuid,
	"company_id" uuid,
	"need_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"category" text,
	"audience" "mail_audience" DEFAULT 'all' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "widget_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"widget_type" text NOT NULL,
	"pos_x" integer DEFAULT 0 NOT NULL,
	"pos_y" integer DEFAULT 0 NOT NULL,
	"width" integer DEFAULT 4 NOT NULL,
	"height" integer DEFAULT 3 NOT NULL,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"candidate_id" uuid,
	"company_id" uuid,
	"need_id" uuid,
	"matching_id" uuid,
	"action_type" text NOT NULL,
	"summary" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_cursus_id_cursus_id_fk" FOREIGN KEY ("cursus_id") REFERENCES "public"."cursus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ypareo_logs" ADD CONSTRAINT "ypareo_logs_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ypareo_logs" ADD CONSTRAINT "ypareo_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ypareo_logs" ADD CONSTRAINT "ypareo_logs_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "needs" ADD CONSTRAINT "needs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "needs" ADD CONSTRAINT "needs_contact_id_company_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."company_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "needs" ADD CONSTRAINT "needs_target_cursus_id_cursus_id_fk" FOREIGN KEY ("target_cursus_id") REFERENCES "public"."cursus"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "needs" ADD CONSTRAINT "needs_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "needs" ADD CONSTRAINT "needs_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchings" ADD CONSTRAINT "matchings_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchings" ADD CONSTRAINT "matchings_need_id_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchings" ADD CONSTRAINT "matchings_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_need_id_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_need_id_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_profiles_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_need_id_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_templates" ADD CONSTRAINT "mail_templates_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widget_configs" ADD CONSTRAINT "widget_configs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_need_id_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_matching_id_matchings_id_fk" FOREIGN KEY ("matching_id") REFERENCES "public"."matchings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidates_status_idx" ON "candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "candidates_owner_idx" ON "candidates" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "candidates_city_idx" ON "candidates" USING btree ("city");--> statement-breakpoint
CREATE INDEX "candidates_email_idx" ON "candidates" USING btree ("email");--> statement-breakpoint
CREATE INDEX "candidates_deleted_at_idx" ON "candidates" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "companies_city_idx" ON "companies" USING btree ("city");--> statement-breakpoint
CREATE INDEX "companies_deleted_at_idx" ON "companies" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "company_contacts_company_idx" ON "company_contacts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "classes_cursus_idx" ON "classes" USING btree ("cursus_id");--> statement-breakpoint
CREATE INDEX "ypareo_logs_correlation_idx" ON "ypareo_logs" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "ypareo_logs_candidate_idx" ON "ypareo_logs" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "ypareo_logs_created_at_idx" ON "ypareo_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "needs_status_idx" ON "needs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "needs_company_idx" ON "needs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "needs_owner_idx" ON "needs" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "needs_deleted_at_idx" ON "needs" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "matchings_candidate_idx" ON "matchings" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "matchings_need_idx" ON "matchings" USING btree ("need_id");--> statement-breakpoint
CREATE INDEX "matchings_proposition_status_idx" ON "matchings" USING btree ("proposition_status");--> statement-breakpoint
CREATE INDEX "documents_candidate_idx" ON "documents" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "documents_company_idx" ON "documents" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "documents_need_idx" ON "documents" USING btree ("need_id");--> statement-breakpoint
CREATE INDEX "tasks_assigned_to_idx" ON "tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "tasks_due_at_idx" ON "tasks" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "tasks_candidate_idx" ON "tasks" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "tasks_company_idx" ON "tasks" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_read_at_idx" ON "notifications" USING btree ("read_at");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "widget_configs_user_idx" ON "widget_configs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_events_candidate_idx" ON "activity_events" USING btree ("candidate_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_events_company_idx" ON "activity_events" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_events_need_idx" ON "activity_events" USING btree ("need_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_events_actor_idx" ON "activity_events" USING btree ("actor_id");
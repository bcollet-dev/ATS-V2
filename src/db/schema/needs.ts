import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  date,
  jsonb,
  check,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { needStatus } from "./enums";
import { profiles } from "./profiles";
import { companies } from "./companies";
import { companyContacts } from "./companies";
import { cursus } from "./ypareo";

export type NeedRemunerationLine = {
  startDate?: string;
  endDate?: string;
  percent?: string;
  reference?: string;
};

export const needs = pgTable(
  "needs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    contactId: uuid("contact_id").references(() => companyContacts.id, { onDelete: "set null" }),

    title: text("title").notNull(),
    missions: text("missions"),
    requirements: text("requirements"),

    targetCursusId: uuid("target_cursus_id").references(() => cursus.id, { onDelete: "set null" }),
    city: text("city"),
    startDate: date("start_date"),
    positionsCount: integer("positions_count").notNull().default(1),

    // Statut pipeline (mis à jour automatiquement par trigger post-matching)
    status: needStatus("status").notNull().default("ad_chase"),

    ownerId: uuid("owner_id").references(() => profiles.id, { onDelete: "set null" }),
    lostReason: text("lost_reason"),
    notes: text("notes"),

    // Maître d'apprentissage
    masterFirstName: text("master_first_name"),
    masterLastName: text("master_last_name"),
    masterBirthName: text("master_birth_name"),
    masterBirthDate: date("master_birth_date"),
    masterJobTitle: text("master_job_title"),
    masterPhone: text("master_phone"),
    masterEmail: text("master_email"),
    masterDiploma: text("master_diploma"),
    masterDiplomaLevel: text("master_diploma_level"),

    // Contrat CERFA FA13
    weeklyHours: text("weekly_hours"),
    contractType: text("contract_type"),
    contractConclusionDate: date("contract_conclusion_date"),
    contractPracticalStartDate: date("contract_practical_start_date"),
    contractMadeAt: text("contract_made_at"),
    salaryReference: text("salary_reference"),
    smcAmount: text("smc_amount"),
    overtimeHandling: text("overtime_handling"),
    endDate: date("end_date"),
    remunerationLines: jsonb("remuneration_lines").$type<NeedRemunerationLine[]>(),
    monthlyGrossSalary: text("monthly_gross_salary"),
    hourlyGrossSalary: text("hourly_gross_salary"),
    rncpCode: text("rncp_code"),

    // Avantages en nature
    benefitFood: text("benefit_food"),
    benefitHousing: text("benefit_housing"),
    benefitOther: text("benefit_other"),

    ypareoNeedId: text("ypareo_need_id"),

    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check("needs_positions_count_check", sql`${t.positionsCount} > 0`),
    index("needs_status_idx").on(t.status),
    index("needs_company_idx").on(t.companyId),
    index("needs_owner_idx").on(t.ownerId),
    index("needs_deleted_at_idx").on(t.deletedAt),
    index("needs_pipeline_idx").on(t.deletedAt, t.status, t.title),
    index("needs_created_at_idx").on(t.createdAt),
    index("needs_target_cursus_idx").on(t.targetCursusId),
  ]
);

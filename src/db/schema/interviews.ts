import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { interviewStatus } from "./enums";
import { cursus } from "./ypareo";
import { candidates } from "./candidates";
import { profiles } from "./profiles";
import { tasks } from "./tasks";

// Trame d'entretien définie par la direction. Rattachée optionnellement à un
// cursus ; la sous-catégorie "Entretien de positionnement" pilote l'admission.
// questions : InterviewQuestion[] (voir src/lib/interview-grid.ts)
export const interviewTrames = pgTable(
  "interview_trames",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    subcategory: text("subcategory").notNull(),
    cursusId: uuid("cursus_id").references(() => cursus.id, { onDelete: "set null" }),
    questions: jsonb("questions").notNull().default([]),
    active: boolean("active").notNull().default(true),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("interview_trames_cursus_idx").on(t.cursusId),
    index("interview_trames_subcategory_idx").on(t.subcategory),
  ]
);

// Entretien passé par un candidat. trame_name / subcategory / cursus_name /
// questions_snapshot figent la trame au moment du démarrage.
// answers : InterviewAnswers ({ [questionId]: { score?, text?, choice?, choices?, matrix? } })
// decision : admissible | temporary_refusal | definitive_refusal (positionnement uniquement)
export const interviews = pgTable(
  "interviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    trameId: uuid("trame_id").references(() => interviewTrames.id, { onDelete: "set null" }),
    trameName: text("trame_name").notNull(),
    subcategory: text("subcategory").notNull(),
    cursusName: text("cursus_name"),
    questionsSnapshot: jsonb("questions_snapshot").notNull().default([]),
    answers: jsonb("answers").notNull().default({}),
    overallNotes: text("overall_notes"),
    decision: text("decision"),
    refusalReason: text("refusal_reason"),
    status: interviewStatus("status").notNull().default("draft"),
    aiSummary: text("ai_summary"),
    aiSummaryGeneratedAt: timestamp("ai_summary_generated_at", { withTimezone: true }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    conductedBy: uuid("conducted_by").references(() => profiles.id, { onDelete: "set null" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("interviews_candidate_idx").on(t.candidateId),
    index("interviews_status_idx").on(t.status),
    index("interviews_completed_at_idx").on(t.completedAt),
  ]
);

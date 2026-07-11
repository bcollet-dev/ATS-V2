import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { interviewStatus } from "./enums";
import { cursus } from "./ypareo";
import { candidates } from "./candidates";
import { profiles } from "./profiles";

// Grille d'entretien définie par cursus (une grille par cursus).
// questions : InterviewQuestion[] (voir src/lib/interview-grid.ts)
export const interviewGrids = pgTable(
  "interview_grids",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cursusId: uuid("cursus_id")
      .notNull()
      .references(() => cursus.id, { onDelete: "cascade" }),
    questions: jsonb("questions").notNull().default([]),
    active: boolean("active").notNull().default(true),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("interview_grids_cursus_unique").on(t.cursusId),
  ]
);

// Entretien EDA passé par un candidat sur la grille de son cursus envisagé.
// grid_snapshot fige la grille au moment de l'entretien ;
// answers : InterviewAnswers ({ [questionId]: { score?, text? } })
export const interviews = pgTable(
  "interviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    gridId: uuid("grid_id").references(() => interviewGrids.id, { onDelete: "set null" }),
    cursusName: text("cursus_name"),
    gridSnapshot: jsonb("grid_snapshot").notNull().default([]),
    answers: jsonb("answers").notNull().default({}),
    overallNotes: text("overall_notes"),
    recommendation: text("recommendation"),
    status: interviewStatus("status").notNull().default("draft"),
    aiSummary: text("ai_summary"),
    aiSummaryGeneratedAt: timestamp("ai_summary_generated_at", { withTimezone: true }),
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

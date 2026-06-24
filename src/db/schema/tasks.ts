import {
  pgTable,
  uuid,
  text,
  timestamp,
  check,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { taskCategory } from "./enums";
import { profiles } from "./profiles";
import { candidates } from "./candidates";
import { companies } from "./companies";
import { needs } from "./needs";

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Au moins une entité référencée
    candidateId: uuid("candidate_id").references(() => candidates.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    needId: uuid("need_id").references(() => needs.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    description: text("description"),
    category: taskCategory("category").notNull().default("follow_up"),

    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    assignedTo: uuid("assigned_to").references(() => profiles.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "tasks_one_entity_check",
      sql`num_nonnulls(${t.candidateId}, ${t.companyId}, ${t.needId}) >= 1`
    ),
    index("tasks_assigned_to_idx").on(t.assignedTo),
    index("tasks_due_at_idx").on(t.dueAt),
    index("tasks_candidate_idx").on(t.candidateId),
    index("tasks_company_idx").on(t.companyId),
  ]
);

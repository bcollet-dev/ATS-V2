import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { taskCategory, taskLinkEntityType } from "./enums";
import { profiles } from "./profiles";
import { candidates } from "./candidates";
import { companies } from "./companies";
import { needs } from "./needs";

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    candidateId: uuid("candidate_id").references(() => candidates.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    needId: uuid("need_id").references(() => needs.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    description: text("description"),
    category: taskCategory("category").notNull().default("follow_up"),

    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by").references(() => profiles.id, { onDelete: "set null" }),

    assignedTo: uuid("assigned_to").references(() => profiles.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    source: text("source"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("tasks_assigned_to_idx").on(t.assignedTo),
    index("tasks_due_at_idx").on(t.dueAt),
    index("tasks_candidate_idx").on(t.candidateId),
    index("tasks_company_idx").on(t.companyId),
    index("tasks_open_due_idx").on(t.completedAt, t.deletedAt, t.dueAt),
  ]
);

export const taskLinks = pgTable(
  "task_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    entityType: taskLinkEntityType("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("task_links_unique_idx").on(t.taskId, t.entityType, t.entityId),
    index("task_links_task_idx").on(t.taskId),
    index("task_links_entity_idx").on(t.entityType, t.entityId),
  ]
);

import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const bugReports = pgTable("bug_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  page: text("page").notNull(),
  action: text("action").notNull(),
  expected: text("expected").notNull(),
  observed: text("observed").notNull(),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  notes: text("notes"),
  reportedBy: uuid("reported_by").references(() => profiles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

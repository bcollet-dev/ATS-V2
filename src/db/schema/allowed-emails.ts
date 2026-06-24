import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { appRole } from "./enums";
import { profiles } from "./profiles";

export const allowedEmails = pgTable("allowed_emails", {
  email: text("email").primaryKey(),
  role: appRole("role").notNull().default("admissions"),
  invitedBy: uuid("invited_by").references(() => profiles.id, { onDelete: "set null" }),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

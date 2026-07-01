import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { mailAudience } from "./enums";
import { profiles } from "./profiles";

export const mailTemplates = pgTable("mail_templates", {
  id: uuid("id").primaryKey().defaultRandom(),

  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  category: text("category"),
  audience: mailAudience("audience").notNull().default("all"),
  active: boolean("active").notNull().default(true),
  isDefaultCvNotification: boolean("is_default_cv_notification").notNull().default(false),

  createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

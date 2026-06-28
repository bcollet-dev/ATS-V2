import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { appRole } from "./enums";

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  role: appRole("role").notNull().default("admissions"),
  active: boolean("active").notNull().default(true),
  nameConfirmed: boolean("name_confirmed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  unique("profiles_email_unique").on(t.email),
]);

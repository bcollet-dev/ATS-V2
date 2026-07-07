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
  googleRefreshToken: text("google_refresh_token"),
  emailSignature: text("email_signature"),
  sigPhotoUrl: text("sig_photo_url"),
  sigJobTitle: text("sig_job_title"),
  sigEntity: text("sig_entity"),
  sigPhone: text("sig_phone"),
  sigLinkedinUrl: text("sig_linkedin_url"),
  sigInstagramUrl: text("sig_instagram_url"),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  unique("profiles_email_unique").on(t.email),
]);

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  date,
  integer,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { ypareoExchangeStatus } from "./enums";
import { profiles } from "./profiles";
import { candidates } from "./candidates";
import { companies } from "./companies";

export const cursus = pgTable(
  "cursus",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: text("external_id"),
    code: text("code"),
    name: text("name").notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    rawData: jsonb("raw_data"),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("cursus_external_id_unique").on(t.externalId),
  ]
);

export const classes = pgTable(
  "classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cursusId: uuid("cursus_id")
      .notNull()
      .references(() => cursus.id, { onDelete: "cascade" }),
    externalId: text("external_id"),
    code: text("code"),
    name: text("name").notNull(),
    site: text("site"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    active: boolean("active").notNull().default(true),
    rawData: jsonb("raw_data"),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("classes_external_id_unique").on(t.externalId),
    index("classes_cursus_idx").on(t.cursusId),
  ]
);

export const ypareoLogs = pgTable(
  "ypareo_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    correlationId: uuid("correlation_id").notNull(),

    candidateId: uuid("candidate_id").references(() => candidates.id, { onDelete: "set null" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),

    operation: text("operation").notNull(),
    endpoint: text("endpoint").notNull(),
    method: text("method").notNull(),
    requestPayload: jsonb("request_payload"),
    responseStatus: integer("response_status"),
    responsePayload: jsonb("response_payload"),
    status: ypareoExchangeStatus("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    retryable: boolean("retryable").notNull().default(false),

    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ypareo_logs_correlation_idx").on(t.correlationId),
    index("ypareo_logs_candidate_idx").on(t.candidateId),
    index("ypareo_logs_created_at_idx").on(t.createdAt),
  ]
);

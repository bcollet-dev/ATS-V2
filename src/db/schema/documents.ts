import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  unique,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { documentType } from "./enums";
import { profiles } from "./profiles";
import { candidates } from "./candidates";
import { companies } from "./companies";
import { needs } from "./needs";

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Exactement une entité référencée
    candidateId: uuid("candidate_id").references(() => candidates.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    needId: uuid("need_id").references(() => needs.id, { onDelete: "cascade" }),

    documentType: documentType("document_type").notNull(),
    fileName: text("file_name").notNull(),
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size").notNull(),

    // Extraction IA
    extractionStatus: text("extraction_status").default("pending"),
    extractedData: jsonb("extracted_data"),
    extractedAt: timestamp("extracted_at", { withTimezone: true }),

    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("documents_storage_path_unique").on(t.storagePath),
    check(
      "documents_one_entity_check",
      sql`num_nonnulls(${t.candidateId}, ${t.companyId}, ${t.needId}) = 1`
    ),
    check("documents_file_size_check", sql`${t.fileSize} >= 0`),
    index("documents_candidate_idx").on(t.candidateId),
    index("documents_company_idx").on(t.companyId),
    index("documents_need_idx").on(t.needId),
  ]
);

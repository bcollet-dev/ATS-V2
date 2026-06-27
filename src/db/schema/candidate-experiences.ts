import { pgTable, uuid, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { candidates } from "./candidates";

export const candidateExperiences = pgTable(
  "candidate_experiences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateId: uuid("candidate_id").notNull().references(() => candidates.id, { onDelete: "cascade" }),
    jobTitle: text("job_title").notNull(),
    company: text("company").notNull(),
    contractType: text("contract_type"),
    startMonth: text("start_month").notNull(),
    endMonth: text("end_month"),
    isCurrent: boolean("is_current").notNull().default(false),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("candidate_experiences_candidate_idx").on(t.candidateId),
  ]
);

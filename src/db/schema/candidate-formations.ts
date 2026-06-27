import { pgTable, uuid, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { candidates } from "./candidates";

export const candidateFormations = pgTable(
  "candidate_formations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateId: uuid("candidate_id").notNull().references(() => candidates.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    institution: text("institution").notNull(),
    startMonth: text("start_month").notNull(),
    endMonth: text("end_month"),
    isCurrent: boolean("is_current").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("candidate_formations_candidate_idx").on(t.candidateId),
  ]
);

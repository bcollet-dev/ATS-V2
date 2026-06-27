import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { candidates } from "./candidates";

export const candidateSkills = pgTable(
  "candidate_skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateId: uuid("candidate_id").notNull().references(() => candidates.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("candidate_skills_candidate_idx").on(t.candidateId),
  ]
);

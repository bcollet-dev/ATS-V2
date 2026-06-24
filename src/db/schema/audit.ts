import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { candidates } from "./candidates";
import { companies } from "./companies";
import { needs } from "./needs";
import { matchings } from "./matchings";

export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    actorId: uuid("actor_id").references(() => profiles.id, { onDelete: "set null" }),

    candidateId: uuid("candidate_id").references(() => candidates.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    needId: uuid("need_id").references(() => needs.id, { onDelete: "cascade" }),
    matchingId: uuid("matching_id").references(() => matchings.id, { onDelete: "cascade" }),

    actionType: text("action_type").notNull(),
    summary: text("summary").notNull(),
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("activity_events_candidate_idx").on(t.candidateId, t.createdAt),
    index("activity_events_company_idx").on(t.companyId, t.createdAt),
    index("activity_events_need_idx").on(t.needId, t.createdAt),
    index("activity_events_actor_idx").on(t.actorId),
  ]
);

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { propositionStatus } from "./enums";
import { profiles } from "./profiles";
import { candidates } from "./candidates";
import { needs } from "./needs";

export const matchings = pgTable(
  "matchings",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    needId: uuid("need_id")
      .notNull()
      .references(() => needs.id, { onDelete: "cascade" }),

    propositionStatus: propositionStatus("proposition_status")
      .notNull()
      .default("cv_sent"),

    // Sélection du gagnant lors du passage en FRE
    isWinner: boolean("is_winner").notNull().default(false),
    // Gelé si non-gagnant suite à sélection d'un gagnant
    isFrozen: boolean("is_frozen").notNull().default(false),

    refusalReason: text("refusal_reason"),
    notes: text("notes"),

    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("matchings_candidate_need_unique").on(t.candidateId, t.needId),
    index("matchings_candidate_idx").on(t.candidateId),
    index("matchings_need_idx").on(t.needId),
    index("matchings_proposition_status_idx").on(t.propositionStatus),
  ]
);

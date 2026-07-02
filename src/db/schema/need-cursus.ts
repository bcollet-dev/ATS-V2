import { pgTable, uuid, primaryKey } from "drizzle-orm/pg-core";
import { needs } from "./needs";
import { cursus } from "./ypareo";

export const needCursus = pgTable(
  "need_cursus",
  {
    needId: uuid("need_id")
      .notNull()
      .references(() => needs.id, { onDelete: "cascade" }),
    cursusId: uuid("cursus_id")
      .notNull()
      .references(() => cursus.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.needId, t.cursusId] })]
);

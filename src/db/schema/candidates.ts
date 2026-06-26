import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  date,
  customType,
  index,
} from "drizzle-orm/pg-core";
import { candidateStatus } from "./enums";
import { profiles } from "./profiles";

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Identité
    title: text("title"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    birthName: text("birth_name"),
    email: text("email"),
    phone: text("phone"),

    // Adresse
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    postalCode: text("postal_code"),
    city: text("city"),

    // Données personnelles sensibles
    birthDate: date("birth_date"),
    birthCity: text("birth_city"),
    birthCountry: text("birth_country"),
    nirEncrypted: bytea("nir_encrypted"),
    nirIv: bytea("nir_iv"),
    rqth: boolean("rqth").notNull().default(false),

    // Parcours
    previousSituationLevel: text("previous_situation_level"),
    skills: text("skills").array(),
    professionalExperiences: text("professional_experiences"),
    previousTrainings: text("previous_trainings"),

    // Parcours souhaité
    cursusEnvisage: text("cursus_envisage"),

    // Suivi recrutement
    source: text("source"),
    ownerId: uuid("owner_id").references(() => profiles.id, { onDelete: "set null" }),
    nextActionAt: timestamp("next_action_at", { withTimezone: true }),
    lostReason: text("lost_reason"),
    notes: text("notes"),

    // Statut pipeline (mis à jour automatiquement par trigger post-admissible)
    status: candidateStatus("status").notNull().default("to_call"),

    // Ypareo
    ypareoPersonId: text("ypareo_person_id"),

    // Métadonnées
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("candidates_status_idx").on(t.status),
    index("candidates_owner_idx").on(t.ownerId),
    index("candidates_city_idx").on(t.city),
    index("candidates_email_idx").on(t.email),
    index("candidates_deleted_at_idx").on(t.deletedAt),
  ]
);

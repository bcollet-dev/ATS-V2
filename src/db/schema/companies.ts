import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    name: text("name").notNull(),
    siret: text("siret"),
    siren: text("siren"),
    nafCode: text("naf_code"),
    legalForm: text("legal_form"),
    employeeRange: text("employee_range"),
    administrativeStatus: text("administrative_status"),

    address: text("address"),
    postalCode: text("postal_code"),
    city: text("city"),
    sector: text("sector"),
    website: text("website"),

    // Données registre public (INSEE/Pappers)
    publicRegistryData: jsonb("public_registry_data"),
    registrySyncedAt: timestamp("registry_synced_at", { withTimezone: true }),

    ownerId: uuid("owner_id").references(() => profiles.id, { onDelete: "set null" }),
    notes: text("notes"),

    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    unique("companies_siret_unique").on(t.siret),
    unique("companies_siren_unique").on(t.siren),
    index("companies_city_idx").on(t.city),
    index("companies_deleted_at_idx").on(t.deletedAt),
  ]
);

export const companyContacts = pgTable(
  "company_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    jobTitle: text("job_title"),
    email: text("email"),
    phone: text("phone"),
    isPrimary: text("is_primary"),

    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("company_contacts_company_idx").on(t.companyId),
  ]
);

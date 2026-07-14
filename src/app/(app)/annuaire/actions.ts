"use server";

import { db } from "@/db";
import { candidates, companies, companyContacts } from "@/db/schema";
import { ilike, or, isNull, and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

export type FilterType = "candidat" | "contact" | "entreprise";

export type CandidatResult = {
  type: "candidat";
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  cursusEnvisage: string | null;
};

export type ContactResult = {
  type: "contact";
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  companyId: string;
  companyName: string;
};

export type EntrepriseResult = {
  type: "entreprise";
  id: string;
  name: string;
  city: string | null;
  siret: string | null;
};

export type SearchResult = CandidatResult | ContactResult | EntrepriseResult;

export async function searchAnnuaire(
  query: string,
  types: FilterType[]
): Promise<SearchResult[]> {
  await requireAuth();
  if (types.length === 0) return [];

  const trimmed = query.trim();
  const isFiltered = trimmed.length >= 2;
  const q = `%${trimmed}%`;
  const limit = isFiltered ? 15 : 50;

  const [candidatsRows, contactsRows, entreprisesRows] = await Promise.all([
    types.includes("candidat")
      ? db
          .select({
            id: candidates.id,
            firstName: candidates.firstName,
            lastName: candidates.lastName,
            email: candidates.email,
            phone: candidates.phone,
            cursusEnvisage: candidates.cursusEnvisage,
          })
          .from(candidates)
          .where(
            isFiltered
              ? and(
                  isNull(candidates.deletedAt),
                  or(
                    ilike(candidates.firstName, q),
                    ilike(candidates.lastName, q),
                    ilike(candidates.email, q),
                    ilike(candidates.phone, q),
                    ilike(candidates.cursusEnvisage, q)
                  )
                )
              : isNull(candidates.deletedAt)
          )
          .limit(limit)
      : Promise.resolve([]),

    types.includes("contact")
      ? db
          .select({
            id: companyContacts.id,
            firstName: companyContacts.firstName,
            lastName: companyContacts.lastName,
            jobTitle: companyContacts.jobTitle,
            email: companyContacts.email,
            phone: companyContacts.phone,
            companyId: companyContacts.companyId,
            companyName: companies.name,
          })
          .from(companyContacts)
          .innerJoin(companies, eq(companyContacts.companyId, companies.id))
          .where(
            isFiltered
              ? and(
                  isNull(companyContacts.deletedAt),
                  isNull(companies.deletedAt),
                  or(
                    ilike(companyContacts.firstName, q),
                    ilike(companyContacts.lastName, q),
                    ilike(companyContacts.email, q),
                    ilike(companyContacts.phone, q)
                  )
                )
              : and(isNull(companyContacts.deletedAt), isNull(companies.deletedAt))
          )
          .limit(limit)
      : Promise.resolve([]),

    types.includes("entreprise")
      ? db
          .select({
            id: companies.id,
            name: companies.name,
            city: companies.city,
            siret: companies.siret,
          })
          .from(companies)
          .where(
            isFiltered
              ? and(
                  isNull(companies.deletedAt),
                  or(
                    ilike(companies.name, q),
                    ilike(companies.siret, q),
                    ilike(companies.city, q)
                  )
                )
              : isNull(companies.deletedAt)
          )
          .limit(limit)
      : Promise.resolve([]),
  ]);

  return [
    ...candidatsRows.map((r) => ({ ...r, type: "candidat" as const })),
    ...contactsRows.map((r) => ({ ...r, type: "contact" as const })),
    ...entreprisesRows.map((r) => ({ ...r, type: "entreprise" as const })),
  ];
}

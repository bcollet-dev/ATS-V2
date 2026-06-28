import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { profiles, companies } from "@/db/schema";
import { eq, isNull, and, asc } from "drizzle-orm";
import { getActiveCursus } from "@/app/(app)/cursus/actions";
import { loadPipelineNeeds } from "./actions";
import { PipelineClient } from "./PipelineClient";

export default async function BesoinsPage() {
  const [, pipelineNeeds, cursus, activeProfiles, activeCompanies] = await Promise.all([
    requireAuth(),
    loadPipelineNeeds(),
    getActiveCursus(),
    db
      .select({ id: profiles.id, fullName: profiles.fullName })
      .from(profiles)
      .where(and(eq(profiles.active, true), isNull(profiles.deletedAt)))
      .orderBy(asc(profiles.fullName)),
    db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(isNull(companies.deletedAt))
      .orderBy(asc(companies.name)),
  ]);

  return (
    <PipelineClient
      needs={pipelineNeeds}
      cursus={cursus}
      profiles={activeProfiles}
      companies={activeCompanies}
    />
  );
}

import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq, isNull, and, asc } from "drizzle-orm";
import { getActiveCursus } from "@/app/(app)/cursus/actions";
import { loadPipelineCandidates } from "./actions";
import { PipelineClient } from "./PipelineClient";

export default async function CandidatsPage() {
  const [, candidates, cursus, activeProfiles] = await Promise.all([
    requireAuth(),
    loadPipelineCandidates(),
    getActiveCursus(),
    db
      .select({ id: profiles.id, fullName: profiles.fullName })
      .from(profiles)
      .where(and(eq(profiles.active, true), isNull(profiles.deletedAt)))
      .orderBy(asc(profiles.fullName)),
  ]);

  return <PipelineClient candidates={candidates} cursus={cursus} profiles={activeProfiles} />;
}

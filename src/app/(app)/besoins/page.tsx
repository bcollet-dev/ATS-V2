import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq, isNull, and, asc } from "drizzle-orm";
import { getActiveCursus } from "@/app/(app)/cursus/actions";
import { loadPipelineNeeds } from "./actions";
import { PipelineClient } from "./PipelineClient";

export default async function BesoinsPage() {
  const [, pipelineNeeds, cursus, activeProfiles] = await Promise.all([
    requireAuth(),
    loadPipelineNeeds(),
    getActiveCursus(),
    db
      .select({ id: profiles.id, fullName: profiles.fullName })
      .from(profiles)
      .where(and(eq(profiles.active, true), isNull(profiles.deletedAt)))
      .orderBy(asc(profiles.fullName)),
  ]);

  return (
    <PipelineClient
      needs={pipelineNeeds}
      cursus={cursus}
      profiles={activeProfiles}
    />
  );
}

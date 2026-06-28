import { requireAuth } from "@/lib/auth";
import { getActiveCursus } from "@/app/(app)/cursus/actions";
import { loadPipelineCandidates } from "./actions";
import { PipelineClient } from "./PipelineClient";

export default async function CandidatsPage() {
  const [, candidates, cursus] = await Promise.all([
    requireAuth(),
    loadPipelineCandidates(),
    getActiveCursus(),
  ]);

  return <PipelineClient candidates={candidates} cursus={cursus} />;
}

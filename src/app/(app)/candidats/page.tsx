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

  return (
    <div className="flex flex-col h-full">
      <PipelineClient candidates={candidates} cursus={cursus} />
    </div>
  );
}

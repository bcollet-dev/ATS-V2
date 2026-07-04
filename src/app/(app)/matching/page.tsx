import { loadCandidatesForMatching, loadNeedsForMatching } from "./actions";
import { MatchingClient } from "./MatchingClient";

export default async function MatchingPage() {
  const [candidates, needs] = await Promise.all([
    loadCandidatesForMatching(),
    loadNeedsForMatching(),
  ]);

  return <MatchingClient candidates={candidates} needs={needs} />;
}

import { requireAuth } from "@/lib/auth";
import { can, type AppRole } from "@/lib/permissions";
import {
  listInterviewCandidates,
  listCompletedInterviews,
  listCandidatesForInterview,
} from "./actions";
import { EntretiensClient } from "./EntretiensClient";

export default async function EntretiensPage() {
  const user = await requireAuth();
  const canConduct = can(user.role as AppRole, "interviews:conduct");
  const [interviewCandidates, completedInterviews, allCandidates] = await Promise.all([
    listInterviewCandidates(),
    listCompletedInterviews(),
    canConduct ? listCandidatesForInterview() : Promise.resolve([]),
  ]);

  return (
    <EntretiensClient
      initialCandidates={interviewCandidates}
      initialCompleted={completedInterviews}
      allCandidates={allCandidates}
      canConduct={canConduct}
      canManageTrames={can(user.role as AppRole, "interviewTrames:manage")}
    />
  );
}

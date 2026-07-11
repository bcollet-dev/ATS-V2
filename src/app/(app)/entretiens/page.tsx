import { requireAuth } from "@/lib/auth";
import { can, type AppRole } from "@/lib/permissions";
import { listInterviewCandidates, listCompletedInterviews } from "./actions";
import { EntretiensClient } from "./EntretiensClient";

export default async function EntretiensPage() {
  const user = await requireAuth();
  const [interviewCandidates, completedInterviews] = await Promise.all([
    listInterviewCandidates(),
    listCompletedInterviews(),
  ]);

  return (
    <EntretiensClient
      initialCandidates={interviewCandidates}
      initialCompleted={completedInterviews}
      canConduct={can(user.role as AppRole, "candidates:edit")}
    />
  );
}

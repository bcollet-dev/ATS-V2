import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import { bugReports, profiles, ypareoLogs, candidates } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { BugTable } from "./BugTable";
import { YpareoLogsTable } from "./YpareoLogsTable";

export default async function ErreursPage() {
  const actor = await requireRole("admin", "direction", "admissions");

  const canSeeBugs = actor.role === "admin" || actor.role === "direction";
  const canSeeYpareoLogs = actor.role === "admin" || actor.role === "admissions";

  const [bugs, ypareoLogRows] = await Promise.all([
    canSeeBugs
      ? db
          .select({
            id: bugReports.id,
            title: bugReports.title,
            page: bugReports.page,
            action: bugReports.action,
            expected: bugReports.expected,
            observed: bugReports.observed,
            priority: bugReports.priority,
            status: bugReports.status,
            notes: bugReports.notes,
            reporterName: profiles.fullName,
            createdAt: bugReports.createdAt,
          })
          .from(bugReports)
          .leftJoin(profiles, eq(bugReports.reportedBy, profiles.id))
          .orderBy(desc(bugReports.createdAt))
      : Promise.resolve([]),
    canSeeYpareoLogs
      ? db
          .select({
            id: ypareoLogs.id,
            createdAt: ypareoLogs.createdAt,
            candidateId: ypareoLogs.candidateId,
            candidateFirstName: candidates.firstName,
            candidateLastName: candidates.lastName,
            operation: ypareoLogs.operation,
            status: ypareoLogs.status,
            errorMessage: ypareoLogs.errorMessage,
            responseStatus: ypareoLogs.responseStatus,
            retryable: ypareoLogs.retryable,
          })
          .from(ypareoLogs)
          .leftJoin(candidates, eq(ypareoLogs.candidateId, candidates.id))
          .orderBy(desc(ypareoLogs.createdAt))
          .limit(200)
      : Promise.resolve([]),
  ]);

  const serializedBugs = bugs.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    reporterName: r.reporterName ?? null,
  }));

  const serializedLogs = ypareoLogRows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    candidateId: r.candidateId ?? null,
    candidateName:
      r.candidateFirstName && r.candidateLastName
        ? `${r.candidateFirstName} ${r.candidateLastName}`
        : null,
    operation: r.operation,
    status: r.status,
    errorMessage: r.errorMessage ?? null,
    responseStatus: r.responseStatus ?? null,
    retryable: r.retryable,
  }));

  return (
    <div className="p-6 max-w-5xl space-y-10">
      {canSeeBugs && (
        <section>
          <div className="mb-6">
            <h1 className="text-2xl font-semibold">Remontées de bugs</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Signalez un bug avec toutes les infos nécessaires pour le reproduire et le corriger.
            </p>
          </div>
          <BugTable initialBugs={serializedBugs} />
        </section>
      )}

      {canSeeYpareoLogs && (
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Logs Ypareo</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Historique des envois vers Ypareo — 200 derniers échanges.
            </p>
          </div>
          <YpareoLogsTable logs={serializedLogs} />
        </section>
      )}
    </div>
  );
}

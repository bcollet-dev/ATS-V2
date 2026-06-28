import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import { bugReports, profiles } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { BugTable } from "./BugTable";

export default async function ErreursPage() {
  await requireRole("admin", "direction");

  const rows = await db
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
    .orderBy(desc(bugReports.createdAt));

  const bugs = rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    reporterName: r.reporterName ?? null,
  }));

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Remontées de bugs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Signalez un bug avec toutes les infos nécessaires pour le reproduire et le corriger.
        </p>
      </div>
      <BugTable initialBugs={bugs} />
    </div>
  );
}

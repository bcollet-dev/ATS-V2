import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { profiles, companies } from "@/db/schema";
import { eq, isNull, and, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { getActiveCursus } from "@/app/(app)/cursus/actions";
import { loadCompany, loadAlternants } from "./actions";
import { loadCompanyTasks } from "./task-actions";
import { listCompanyDocuments } from "./document-actions";
import { CompanyHeader } from "./CompanyHeader";
import { BlocInfos } from "./BlocInfos";
import { BlocPersonnel } from "./BlocPersonnel";
import { BlocBesoins } from "./BlocBesoins";
import { BlocTaches } from "./BlocTaches";
import { BlocDocuments } from "./BlocDocuments";
import { BlocHistorique } from "./BlocHistorique";
import { BlocConsultantReferent } from "./BlocConsultantReferent";
import { BlocGmail } from "@/app/(app)/mail/BlocGmail";
import { TaskContextScope } from "@/components/tasks/FloatingTaskCreator";

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [actor, { id }] = await Promise.all([requireAuth(), params]);

  const [data, alternants, tasks, documents, activeProfiles, cursus, allCompanies] =
    await Promise.all([
      loadCompany(id),
      loadAlternants(id),
      loadCompanyTasks(id),
      listCompanyDocuments(id),
      db
        .select({ id: profiles.id, fullName: profiles.fullName, email: profiles.email })
        .from(profiles)
        .where(and(eq(profiles.active, true), isNull(profiles.deletedAt)))
        .orderBy(asc(profiles.fullName)),
      getActiveCursus(),
      db
        .select({ id: companies.id, name: companies.name })
        .from(companies)
        .where(isNull(companies.deletedAt))
        .orderBy(asc(companies.name)),
    ]);

  if (!data) notFound();
  const { company, contacts, linkedNeeds } = data;
  const canEdit = actor.role !== "direction";

  // Task rows need assignee names
  const tasksWithNames = tasks.map((t) => {
    const p = activeProfiles.find((p) => p.id === t.assignedTo);
    return { ...t, assigneeName: p ? (p.fullName || p.email) : null };
  });

  return (
    <div className="p-6">
      <TaskContextScope
        attachment={{
          entityType: "company",
          entityId: company.id,
          label: company.name,
          sub: "Entreprise",
        }}
      />

      <Link
        href="/annuaire"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à l&apos;annuaire
      </Link>

      {/* Archived banner */}
      {company.deletedAt && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Entreprise archivée</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Cette fiche est archivée et n&apos;apparaît plus dans l&apos;annuaire.
            </p>
          </div>
        </div>
      )}

      {/* Header (client pour le menu 3 points) */}
      <CompanyHeader company={company} canEdit={canEdit} />

      {/* Layout 2 colonnes */}
      <div className="flex gap-6 items-start">
        {/* Colonne principale */}
        <div className="flex-1 min-w-0 space-y-6">
          <BlocInfos companyId={id} initialData={company} canEdit={canEdit} />

          <div className="grid grid-cols-2 gap-6 items-start">
            <BlocBesoins
              companyId={id}
              companyName={company.name}
              initialNeeds={linkedNeeds}
              companies={allCompanies}
              cursus={cursus}
              profiles={activeProfiles.map((p) => ({ id: p.id, fullName: p.fullName }))}
              canEdit={canEdit}
            />
            <BlocDocuments companyId={id} initialDocuments={documents} canEdit={canEdit} />
          </div>

          <div className="grid grid-cols-2 gap-6 items-start">
            <BlocTaches
              companyId={id}
              companyName={company.name}
              initialTasks={tasksWithNames}
              profiles={activeProfiles}
              currentUserId={actor.id}
              canEdit={canEdit}
            />
            <BlocHistorique companyId={id} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 shrink-0 space-y-4">
          <BlocConsultantReferent
            companyId={id}
            initialOwnerId={company.ownerId}
            profiles={activeProfiles.map((p) => ({ id: p.id, fullName: p.fullName }))}
            canEdit={canEdit}
          />
          <BlocPersonnel
            companyId={id}
            initialContacts={contacts}
            alternants={alternants}
            canEdit={canEdit}
          />
          <BlocGmail
            kind="company"
            entityId={company.id}
            nextPath={`/annuaire/${company.id}`}
          />
        </div>
      </div>
    </div>
  );
}

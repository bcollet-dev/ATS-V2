import { requireAuth } from "@/lib/auth";
import { can, type AppRole } from "@/lib/permissions";
import { db } from "@/db";
import {
  candidates, candidateExperiences, candidateFormations,
  candidateSkills, profiles,
} from "@/db/schema";
import { eq, isNull, and, desc, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DeleteEntityButton } from "@/components/entities/DeleteEntityButton";
import { getActiveCursus } from "@/app/(app)/cursus/actions";
import { BlocIdentite } from "./BlocIdentite";
import { BlocContact } from "./BlocContact";
import { BlocGmail } from "@/app/(app)/mail/BlocGmail";
import { BlocRecrutement } from "./BlocRecrutement";
import { BlocCompetences } from "./BlocCompetences";
import { BlocExperiences } from "./BlocExperiences";
import { BlocFormations } from "./BlocFormations";
import { BlocTaches } from "./BlocTaches";
import { BlocHistorique } from "./BlocHistorique";
import { BlocMatchings } from "./BlocMatchings";
import { BlocDocuments } from "./BlocDocuments";
import {
  loadMatchingsForCandidate,
  loadAvailableNeedsForCandidate,
} from "@/app/(app)/matching/actions";
import { listCandidateDocuments } from "./document-actions";
import { loadCandidateTasks } from "./task-actions";
import { TaskContextScope } from "@/components/tasks/FloatingTaskCreator";
import { GenerateFreButton } from "@/components/fre/GenerateFreButton";
import { resolveFrenchBirthDepartment } from "@/lib/birth-department";

const STATUS_LABELS: Record<string, string> = {
  to_call: "À appeler",
  in_progress: "En cours",
  no_response: "NRP",
  interview: "Entretien EDA",
  pvpp: "PVPP",
  admissible: "Admissible",
  company_interview: "Entretien entreprise",
  waiting_fre: "Attente FRE",
  placed: "Placé",
  temporary_refusal: "Refus temporaire",
  definitive_refusal: "Refus définitif",
  contract_break: "Rupture",
};

const STATUS_BADGE: Record<string, string> = {
  placed: "bg-emerald-100 text-emerald-700",
  admissible: "bg-blue-100 text-blue-700",
  waiting_fre: "bg-violet-100 text-violet-700",
  definitive_refusal: "bg-red-100 text-red-700",
  contract_break: "bg-red-100 text-red-700",
  no_response: "bg-amber-100 text-amber-700",
};

export default async function CandidatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [user, { id }, cursus] = await Promise.all([
    requireAuth(),
    params,
    getActiveCursus(),
  ]);

  const [candidat, experiences, formations, skills, candidateTasks, activeProfiles, candidateMatchings, availableNeeds, candidateDocs] = await Promise.all([
    db.query.candidates.findFirst({
      where: and(eq(candidates.id, id), isNull(candidates.deletedAt)),
    }),
    db
      .select({
        id: candidateExperiences.id,
        candidateId: candidateExperiences.candidateId,
        jobTitle: candidateExperiences.jobTitle,
        company: candidateExperiences.company,
        contractType: candidateExperiences.contractType,
        startMonth: candidateExperiences.startMonth,
        endMonth: candidateExperiences.endMonth,
        isCurrent: candidateExperiences.isCurrent,
        description: candidateExperiences.description,
      })
      .from(candidateExperiences)
      .where(eq(candidateExperiences.candidateId, id))
      .orderBy(desc(candidateExperiences.startMonth)),
    db
      .select({
        id: candidateFormations.id,
        candidateId: candidateFormations.candidateId,
        title: candidateFormations.title,
        institution: candidateFormations.institution,
        startMonth: candidateFormations.startMonth,
        endMonth: candidateFormations.endMonth,
        isCurrent: candidateFormations.isCurrent,
      })
      .from(candidateFormations)
      .where(eq(candidateFormations.candidateId, id))
      .orderBy(desc(candidateFormations.startMonth)),
    db
      .select({ id: candidateSkills.id, name: candidateSkills.name })
      .from(candidateSkills)
      .where(eq(candidateSkills.candidateId, id))
      .orderBy(asc(candidateSkills.createdAt)),
    loadCandidateTasks(id),
    db
      .select({ id: profiles.id, fullName: profiles.fullName, email: profiles.email })
      .from(profiles)
      .where(and(eq(profiles.active, true), isNull(profiles.deletedAt)))
      .orderBy(asc(profiles.fullName)),
    loadMatchingsForCandidate(id),
    loadAvailableNeedsForCandidate(id),
    listCandidateDocuments(id),
  ]);

  if (!candidat) notFound();

  const resolvedBirthDepartment = await resolveFrenchBirthDepartment({
    currentDepartment: candidat.birthDepartment,
    birthCity: candidat.birthCity,
    birthCountry: candidat.birthCountry,
  });
  if (resolvedBirthDepartment && resolvedBirthDepartment !== candidat.birthDepartment) {
    await db
      .update(candidates)
      .set({ birthDepartment: resolvedBirthDepartment, updatedAt: new Date() })
      .where(eq(candidates.id, candidat.id));
    candidat.birthDepartment = resolvedBirthDepartment;
  }

  const role = user.role as AppRole;
  const canRevealNir = can(role, "candidates:viewNir");
  const canEditCandidate = can(role, "candidates:edit");
  const canDeleteCandidate = can(role, "candidates:delete");
  const canCreateMatching = can(role, "matchings:create");
  const canGenerateFre = role !== "direction";
  const badgeClass = STATUS_BADGE[candidat.status] ?? "bg-muted text-muted-foreground";
  const freMatching = candidat.status === "waiting_fre"
    ? candidateMatchings.find((matching) => matching.propositionStatus === "waiting_fre" && !matching.isFrozen)
      ?? candidateMatchings.find((matching) => matching.needStatus === "waiting_fre" && !matching.isFrozen)
      ?? null
    : null;

  const serializedTasks = candidateTasks;

  return (
    <div className="max-w-5xl p-4 sm:p-6">
      <TaskContextScope
        attachment={{
          entityType: "candidate",
          entityId: candidat.id,
          label: `${candidat.firstName} ${candidat.lastName}`,
          sub: "Candidat",
        }}
      />

      <Link
        href="/candidats"
        className="mb-4 flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground sm:mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au pipeline
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold">
            {candidat.firstName} {candidat.lastName}
          </h1>
          {candidat.cursusEnvisage && (
            <p className="text-sm text-muted-foreground mt-1">{candidat.cursusEnvisage}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canGenerateFre && freMatching && (
            <GenerateFreButton
              needId={freMatching.needId}
              candidateId={candidat.id}
              size="sm"
              className="h-8"
              label="Générer FRE"
            />
          )}
          <Badge className={`text-xs font-medium px-2 py-1 rounded-md border-0 ${badgeClass}`}>
            {STATUS_LABELS[candidat.status] ?? candidat.status}
          </Badge>
          {candidat.ypareoPersonId && (
            <Badge className="text-xs font-medium px-2 py-1 rounded-md border-0 bg-violet-100 text-violet-700">
              Sur Ypareo
            </Badge>
          )}
          {candidat.status === "contract_break" && candidat.ruptureRechercheDeadline && (() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const d = new Date(candidat.ruptureRechercheDeadline);
            d.setHours(0, 0, 0, 0);
            const diffDays = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const label = diffDays < 0
              ? `Délai dépassé (${Math.abs(diffDays)}j)`
              : `Délai : ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })} (${diffDays}j)`;
            const cls = diffDays < 0
              ? "bg-red-100 text-red-700"
              : diffDays <= 30
                ? "bg-amber-100 text-amber-700"
                : "bg-muted text-muted-foreground";
            return (
              <Badge className={`text-xs font-medium px-2 py-1 rounded-md border-0 ${cls}`}>
                {label}
              </Badge>
            );
          })()}
          {canDeleteCandidate && (
            <DeleteEntityButton
              entityType="candidate"
              entityId={candidat.id}
              label={`${candidat.firstName} ${candidat.lastName}`}
              redirectTo="/candidats"
            />
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Contact en surbrillance */}
        <BlocContact
          candidateId={candidat.id}
          data={{ email: candidat.email, phone: candidat.phone }}
          canEdit={canEditCandidate}
        />

        {/* Identité (2/3) | Gmail (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <div className="lg:col-span-2">
            <BlocIdentite
              candidateId={candidat.id}
              canRevealNir={canRevealNir}
              canEdit={canEditCandidate}
              data={{
                title: candidat.title,
                firstName: candidat.firstName,
                lastName: candidat.lastName,
                birthName: candidat.birthName,
                birthDate: candidat.birthDate,
                birthCity: candidat.birthCity,
                birthDepartment: candidat.birthDepartment,
                birthCountry: candidat.birthCountry,
                nationality: candidat.nationality,
                rqth: candidat.rqth,
                hasNir: !!(candidat.nirEncrypted && candidat.nirEncrypted.length > 0),
                addressLine1: candidat.addressLine1,
                addressLine2: candidat.addressLine2,
                postalCode: candidat.postalCode,
                city: candidat.city,
                legalRepFirstName: candidat.legalRepFirstName,
                legalRepLastName: candidat.legalRepLastName,
                legalRepLink: candidat.legalRepLink,
                legalRepPhone: candidat.legalRepPhone,
                legalRepEmail: candidat.legalRepEmail,
              }}
            />
          </div>
          <BlocGmail
            kind="candidate"
            entityId={candidat.id}
            nextPath={`/candidats/${candidat.id}`}
          />
        </div>

        {/* Recrutement */}
        <BlocRecrutement
          candidateId={candidat.id}
          cursus={cursus}
          data={{ cursusEnvisage: candidat.cursusEnvisage, source: candidat.source }}
          canEdit={canEditCandidate}
        />

        {/* Tâches */}
        <BlocTaches
          candidateId={candidat.id}
          candidateName={`${candidat.firstName} ${candidat.lastName}`}
          initialTasks={serializedTasks}
          profiles={activeProfiles}
          currentUserId={user.id}
        />

        {/* Documents */}
        <BlocDocuments candidateId={candidat.id} initialDocuments={candidateDocs} />

        {/* Parcours */}
        <section className="rounded-lg border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b">
            <h2 className="text-sm font-semibold">Parcours</h2>
          </div>
          <div className="divide-y">
            <BlocCompetences
              key={skills.map((s) => s.id).join(",")}
              candidateId={candidat.id}
              initialSkills={skills}
              embedded
              canEdit={canEditCandidate}
            />
            <BlocExperiences
              key={experiences.map((e) => e.id).join(",")}
              candidateId={candidat.id}
              initialExperiences={experiences}
              embedded
              canEdit={canEditCandidate}
            />
            <BlocFormations
              key={formations.map((f) => f.id).join(",")}
              candidateId={candidat.id}
              initialFormations={formations}
              embedded
              canEdit={canEditCandidate}
            />
          </div>
        </section>

        {/* Besoins liés */}
        <BlocMatchings
          candidateId={candidat.id}
          initialMatchings={candidateMatchings}
          availableNeeds={availableNeeds}
          candidateStatus={candidat.status}
          canCreateMatching={canCreateMatching}
        />

        {/* Historique */}
        <BlocHistorique candidateId={candidat.id} />
      </div>
    </div>
  );
}

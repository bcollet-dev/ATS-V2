import { requireAuth } from "@/lib/auth";
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

  const canRevealNir = user.role === "admin" || user.role === "admissions";
  const badgeClass = STATUS_BADGE[candidat.status] ?? "bg-muted text-muted-foreground";

  const serializedTasks = candidateTasks;

  return (
    <div className="p-6 max-w-5xl">
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
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au pipeline
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">
            {candidat.firstName} {candidat.lastName}
          </h1>
          {candidat.cursusEnvisage && (
            <p className="text-sm text-muted-foreground mt-1">{candidat.cursusEnvisage}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`text-xs font-medium px-2 py-1 rounded-md border-0 ${badgeClass}`}>
            {STATUS_LABELS[candidat.status] ?? candidat.status}
          </Badge>
          {candidat.ypareoPersonId && (
            <Badge className="text-xs font-medium px-2 py-1 rounded-md border-0 bg-violet-100 text-violet-700">
              Sur Ypareo
            </Badge>
          )}
          <DeleteEntityButton
            entityType="candidate"
            entityId={candidat.id}
            label={`${candidat.firstName} ${candidat.lastName}`}
            redirectTo="/candidats"
          />
        </div>
      </div>

      <div className="space-y-4">
        {/* Contact en surbrillance */}
        <BlocContact
          candidateId={candidat.id}
          data={{ email: candidat.email, phone: candidat.phone }}
        />

        {/* Identité (2/3) | Gmail (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <div className="lg:col-span-2">
            <BlocIdentite
              candidateId={candidat.id}
              canRevealNir={canRevealNir}
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
            />
            <BlocExperiences
              key={experiences.map((e) => e.id).join(",")}
              candidateId={candidat.id}
              initialExperiences={experiences}
              embedded
            />
            <BlocFormations
              key={formations.map((f) => f.id).join(",")}
              candidateId={candidat.id}
              initialFormations={formations}
              embedded
            />
          </div>
        </section>

        {/* Besoins liés */}
        <BlocMatchings
          candidateId={candidat.id}
          initialMatchings={candidateMatchings}
          availableNeeds={availableNeeds}
        />

        {/* Historique */}
        <BlocHistorique candidateId={candidat.id} />
      </div>
    </div>
  );
}

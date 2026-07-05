import { requireAuth } from "@/lib/auth";
import { can, type AppRole } from "@/lib/permissions";
import { db } from "@/db";
import { needs, companies, companyContacts, profiles, cursus } from "@/db/schema";
import { eq, isNull, and, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  loadMatchingsForNeed,
  loadAvailableCandidatesForNeed,
} from "@/app/(app)/matching/actions";
import { loadNeedCursus } from "@/app/(app)/besoins/actions";
import { BlocPropositions } from "./BlocPropositions";
import { BlocCursus } from "./BlocCursus";
import { BlocHistorique } from "./BlocHistorique";
import { SidebarEntreprise } from "./SidebarEntreprise";
import { BlocFre } from "./BlocFre";
import { BlocCerfa } from "./BlocCerfa";
import { NeedContractDrawer } from "./NeedContractDrawer";
import { loadNeedFreDocuments } from "./fre-actions";
import { BlocGmail } from "@/app/(app)/mail/BlocGmail";
import { TaskContextScope } from "@/components/tasks/FloatingTaskCreator";
import { GenerateFreButton } from "@/components/fre/GenerateFreButton";
import { loadYpareoPlacementDraft } from "@/app/(app)/ypareo/actions";
import type { YpareoPlacementDraft } from "@/lib/ypareo/placement-draft";

const STATUS_LABELS: Record<string, string> = {
  ad_chase:         "Ad Chase",
  prospect:         "Prospect",
  need_in_progress: "Besoin en cours",
  a_shooter:        "À shooter",
  cv_envoye:        "CV envoyé",
  interview:        "Entretien",
  waiting_fre:      "Attente FRE",
  client:           "Client",
  rupture:          "Rupture",
  lost:             "Perdu",
};

const STATUS_BADGE: Record<string, string> = {
  ad_chase:         "bg-slate-100 text-slate-700",
  prospect:         "bg-blue-100 text-blue-700",
  need_in_progress: "bg-violet-100 text-violet-700",
  a_shooter:        "bg-amber-100 text-amber-700",
  cv_envoye:        "bg-sky-100 text-sky-700",
  interview:        "bg-orange-100 text-orange-700",
  waiting_fre:      "bg-amber-100 text-amber-700",
  client:           "bg-emerald-100 text-emerald-700",
  rupture:          "bg-red-100 text-red-700",
  lost:             "bg-gray-100 text-gray-600",
};

async function loadCerfaDraftForNeed(needId: string): Promise<{
  draft: YpareoPlacementDraft | null;
  error: string | null;
}> {
  try {
    return { draft: await loadYpareoPlacementDraft("need", needId), error: null };
  } catch (err) {
    return {
      draft: null,
      error: err instanceof Error ? err.message : "Impossible de charger les champs CERFA.",
    };
  }
}

export default async function BesoinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [actor, { id }] = await Promise.all([requireAuth(), params]);

  const [needRows, matchingRows, availableCandidates, selectedCursus, allCursus, freDocuments, companyContactRows, cerfaDraftResult] = await Promise.all([
    db
      .select({
        id: needs.id,
        title: needs.title,
        status: needs.status,
        city: needs.city,
        positionsCount: needs.positionsCount,
        companyId: needs.companyId,
        contactId: needs.contactId,
        companyName: companies.name,
        ownerName: profiles.fullName,
        lostReason: needs.lostReason,
        notes: needs.notes,
        // Champs CERFA
        startDate: needs.startDate,
        weeklyHours: needs.weeklyHours,
        contractType: needs.contractType,
        contractConclusionDate: needs.contractConclusionDate,
        contractPracticalStartDate: needs.contractPracticalStartDate,
        contractMadeAt: needs.contractMadeAt,
        salaryReference: needs.salaryReference,
        smcAmount: needs.smcAmount,
        overtimeHandling: needs.overtimeHandling,
        endDate: needs.endDate,
        remunerationLines: needs.remunerationLines,
        monthlyGrossSalary: needs.monthlyGrossSalary,
        hourlyGrossSalary: needs.hourlyGrossSalary,
        rncpCode: needs.rncpCode,
        masterFirstName: needs.masterFirstName,
        masterLastName: needs.masterLastName,
        masterBirthName: needs.masterBirthName,
        masterBirthDate: needs.masterBirthDate,
        masterJobTitle: needs.masterJobTitle,
        masterPhone: needs.masterPhone,
        masterEmail: needs.masterEmail,
        masterDiploma: needs.masterDiploma,
        masterDiplomaLevel: needs.masterDiplomaLevel,
        benefitFood: needs.benefitFood,
        benefitHousing: needs.benefitHousing,
        benefitOther: needs.benefitOther,
      })
      .from(needs)
      .leftJoin(companies, eq(needs.companyId, companies.id))
      .leftJoin(profiles, eq(needs.ownerId, profiles.id))
      .where(and(eq(needs.id, id), isNull(needs.deletedAt))),
    loadMatchingsForNeed(id),
    loadAvailableCandidatesForNeed(id),
    loadNeedCursus(id),
    db
      .select({ id: cursus.id, name: cursus.name, code: cursus.code })
      .from(cursus)
      .where(eq(cursus.active, true))
      .orderBy(asc(cursus.name)),
    loadNeedFreDocuments(id),
    db
      .select({
        id: companyContacts.id,
        firstName: companyContacts.firstName,
        lastName: companyContacts.lastName,
        jobTitle: companyContacts.jobTitle,
        email: companyContacts.email,
        phone: companyContacts.phone,
      })
      .from(needs)
      .innerJoin(companyContacts, eq(companyContacts.companyId, needs.companyId))
      .where(and(eq(needs.id, id), isNull(companyContacts.deletedAt)))
      .orderBy(asc(companyContacts.firstName), asc(companyContacts.lastName)),
    loadCerfaDraftForNeed(id),
  ]);

  const need = needRows[0];
  if (!need) notFound();

  const badgeClass = STATUS_BADGE[need.status] ?? "bg-muted text-muted-foreground";
  const role = actor.role as AppRole;
  const canEdit = can(role, "needs:edit");
  const remunerationLines = Array.isArray(need.remunerationLines)
    ? need.remunerationLines
    : [];

  const contractValues = {
    contactId: need.contactId ?? undefined,
    startDate: need.startDate ?? undefined,
    weeklyHours: need.weeklyHours ?? undefined,
    contractType: need.contractType ?? undefined,
    contractConclusionDate: need.contractConclusionDate ?? undefined,
    contractPracticalStartDate: need.contractPracticalStartDate ?? undefined,
    contractMadeAt: need.contractMadeAt ?? "Courbevoie",
    salaryReference: need.salaryReference ?? undefined,
    smcAmount: need.smcAmount ?? undefined,
    overtimeHandling: need.overtimeHandling ?? undefined,
    endDate: need.endDate ?? undefined,
    ...Object.fromEntries(
      Array.from({ length: 8 }, (_, index) => {
        const position = index + 1;
        const line = remunerationLines[index];
        return [
          [`remunerationStart${position}`, line?.startDate],
          [`remunerationEnd${position}`, line?.endDate],
          [`remunerationPercent${position}`, line?.percent],
          [`remunerationReference${position}`, line?.reference],
        ];
      }).flat(),
    ),
    monthlyGrossSalary: need.monthlyGrossSalary ?? undefined,
    hourlyGrossSalary: need.hourlyGrossSalary ?? undefined,
    rncpCode: need.rncpCode ?? undefined,
    masterFirstName: need.masterFirstName ?? undefined,
    masterLastName: need.masterLastName ?? undefined,
    masterBirthName: need.masterBirthName ?? undefined,
    masterBirthDate: need.masterBirthDate ?? undefined,
    masterJobTitle: need.masterJobTitle ?? undefined,
    masterPhone: need.masterPhone ?? undefined,
    masterEmail: need.masterEmail ?? undefined,
    masterDiploma: need.masterDiploma ?? undefined,
    masterDiplomaLevel: need.masterDiplomaLevel ?? undefined,
    benefitFood: need.benefitFood ?? undefined,
    benefitHousing: need.benefitHousing ?? undefined,
    benefitOther: need.benefitOther ?? undefined,
  };

  return (
    <div className="max-w-7xl p-4 sm:p-6">
      {need.companyId && need.companyName && (
        <TaskContextScope
          attachment={{
            entityType: "company",
            entityId: need.companyId,
            label: need.companyName,
            sub: "Entreprise",
          }}
        />
      )}

      <Link
        href="/besoins"
        className="mb-4 flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground sm:mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au pipeline
      </Link>

      {/* Header */}
      <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold">{need.title}</h1>
          <p className="text-base text-muted-foreground mt-0.5">{need.companyName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {need.status === "waiting_fre" && canEdit && (
            <GenerateFreButton
              needId={id}
              size="sm"
              className="h-8"
              label="Générer FRE"
            />
          )}
          <Badge className={`text-xs font-medium px-2 py-1 rounded-md border-0 ${badgeClass}`}>
            {STATUS_LABELS[need.status] ?? need.status}
          </Badge>
        </div>
      </div>

      {/* Meta */}
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground sm:mb-8">
        {need.city && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />{need.city}
          </span>
        )}
        {need.positionsCount > 1 && (
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />{need.positionsCount} postes
          </span>
        )}
        {need.ownerName && <span>Recruteur : {need.ownerName}</span>}
      </div>

      {/* Layout 2 colonnes */}
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        {/* Colonne principale */}
        <div className="flex-1 min-w-0 space-y-6">
          <BlocCerfa
            draft={cerfaDraftResult.draft}
            error={cerfaDraftResult.error}
            canEdit={canEdit}
            contractAction={(
              <NeedContractDrawer
                needId={id}
                initialValues={contractValues}
                contacts={companyContactRows}
                canEdit={canEdit}
              />
            )}
          />

          <BlocCursus
            needId={id}
            initialSelected={selectedCursus}
            allCursus={allCursus}
            canEdit={canEdit}
          />

          {/* BlocPropositions (tranche 07 le rebranche avec logActivityEvent) */}
          <BlocPropositions
            needId={id}
            needStatus={need.status}
            initialMatchings={matchingRows}
            availableCandidates={availableCandidates}
          />

          <BlocHistorique needId={id} />
        </div>

        {/* Sidebar */}
        <div className="w-full shrink-0 space-y-4 xl:w-80">
          <SidebarEntreprise needId={id} canEdit={canEdit} />
          <BlocGmail
            kind="need"
            entityId={id}
            nextPath={`/besoins/${id}`}
          />
          <BlocFre
            needId={id}
            initialDocuments={freDocuments}
            canEdit={canEdit}
          />
        </div>
      </div>
    </div>
  );
}

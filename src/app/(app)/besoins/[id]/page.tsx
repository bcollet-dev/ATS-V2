import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { needs, companies, profiles, cursus } from "@/db/schema";
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
import { NeedContractDrawer } from "./NeedContractDrawer";
import { loadNeedFreDocuments } from "./fre-actions";
import { BlocGmail } from "@/app/(app)/mail/BlocGmail";
import { TaskContextScope } from "@/components/tasks/FloatingTaskCreator";

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

export default async function BesoinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [actor, { id }] = await Promise.all([requireAuth(), params]);

  const [needRows, matchingRows, availableCandidates, selectedCursus, allCursus, freDocuments] = await Promise.all([
    db
      .select({
        id: needs.id,
        title: needs.title,
        status: needs.status,
        city: needs.city,
        positionsCount: needs.positionsCount,
        companyId: needs.companyId,
        companyName: companies.name,
        ownerName: profiles.fullName,
        lostReason: needs.lostReason,
        notes: needs.notes,
        // Champs CERFA
        weeklyHours: needs.weeklyHours,
        contractType: needs.contractType,
        salaryReference: needs.salaryReference,
        smcAmount: needs.smcAmount,
        overtimeHandling: needs.overtimeHandling,
        endDate: needs.endDate,
        masterFirstName: needs.masterFirstName,
        masterLastName: needs.masterLastName,
        masterBirthDate: needs.masterBirthDate,
        masterJobTitle: needs.masterJobTitle,
        masterPhone: needs.masterPhone,
        masterEmail: needs.masterEmail,
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
  ]);

  const need = needRows[0];
  if (!need) notFound();

  const badgeClass = STATUS_BADGE[need.status] ?? "bg-muted text-muted-foreground";
  const canEdit = actor.role !== "direction";

  const contractValues = {
    weeklyHours: need.weeklyHours ?? undefined,
    contractType: need.contractType ?? undefined,
    salaryReference: need.salaryReference ?? undefined,
    smcAmount: need.smcAmount ?? undefined,
    overtimeHandling: need.overtimeHandling ?? undefined,
    endDate: need.endDate ?? undefined,
    masterFirstName: need.masterFirstName ?? undefined,
    masterLastName: need.masterLastName ?? undefined,
    masterBirthDate: need.masterBirthDate ?? undefined,
    masterJobTitle: need.masterJobTitle ?? undefined,
    masterPhone: need.masterPhone ?? undefined,
    masterEmail: need.masterEmail ?? undefined,
    benefitFood: need.benefitFood ?? undefined,
    benefitHousing: need.benefitHousing ?? undefined,
    benefitOther: need.benefitOther ?? undefined,
  };

  return (
    <div className="p-6 max-w-7xl">
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
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au pipeline
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-2xl font-semibold">{need.title}</h1>
          <p className="text-base text-muted-foreground mt-0.5">{need.companyName}</p>
        </div>
        <Badge className={`text-xs font-medium px-2 py-1 rounded-md border-0 ${badgeClass}`}>
          {STATUS_LABELS[need.status] ?? need.status}
        </Badge>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8">
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
      <div className="flex gap-6 items-start">
        {/* Colonne principale */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Bouton CERFA drawer */}
          <div className="flex items-center gap-2">
            <NeedContractDrawer
              needId={id}
              initialValues={contractValues}
              canEdit={canEdit}
            />
          </div>

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
        <div className="w-80 shrink-0 space-y-4">
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

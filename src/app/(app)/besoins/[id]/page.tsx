import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { needs, companies, cursus, profiles } from "@/db/schema";
import { eq, isNull, and, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  loadMatchingsForNeed,
  loadAvailableCandidatesForNeed,
} from "@/app/(app)/matching/actions";
import { BlocPropositions } from "./BlocPropositions";

const STATUS_LABELS: Record<string, string> = {
  ad_chase:         "À démarcher",
  prospect:         "Prospect",
  need_in_progress: "Besoin en cours",
  interview:        "Entretien",
  waiting_fre:      "Attente FRE",
  client:           "Client",
  rupture:          "Rupture",
};

const STATUS_BADGE: Record<string, string> = {
  ad_chase:         "bg-slate-100 text-slate-700",
  prospect:         "bg-blue-100 text-blue-700",
  need_in_progress: "bg-violet-100 text-violet-700",
  interview:        "bg-orange-100 text-orange-700",
  waiting_fre:      "bg-amber-100 text-amber-700",
  client:           "bg-emerald-100 text-emerald-700",
  rupture:          "bg-red-100 text-red-700",
};

export default async function BesoinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [, { id }] = await Promise.all([requireAuth(), params]);

  const [needRows, matchingRows, availableCandidates] = await Promise.all([
    db
      .select({
        id: needs.id,
        title: needs.title,
        status: needs.status,
        city: needs.city,
        positionsCount: needs.positionsCount,
        companyName: companies.name,
        targetCursusName: cursus.name,
        ownerName: profiles.fullName,
        lostReason: needs.lostReason,
        notes: needs.notes,
      })
      .from(needs)
      .leftJoin(companies, eq(needs.companyId, companies.id))
      .leftJoin(cursus, eq(needs.targetCursusId, cursus.id))
      .leftJoin(profiles, eq(needs.ownerId, profiles.id))
      .where(and(eq(needs.id, id), isNull(needs.deletedAt))),
    loadMatchingsForNeed(id),
    loadAvailableCandidatesForNeed(id),
  ]);

  const need = needRows[0];
  if (!need) notFound();

  const badgeClass = STATUS_BADGE[need.status] ?? "bg-muted text-muted-foreground";

  return (
    <div className="p-6 max-w-4xl">
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
        {need.targetCursusName && <span>{need.targetCursusName}</span>}
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

      {/* Propositions */}
      <BlocPropositions
        needId={id}
        initialMatchings={matchingRows}
        availableCandidates={availableCandidates}
      />
    </div>
  );
}

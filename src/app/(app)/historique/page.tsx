import { requireRole } from "@/lib/auth";
import { loadEvents, getActors } from "./actions";
import { HistoriqueClient } from "./HistoriqueClient";

export default async function HistoriquePage({
  searchParams,
}: {
  searchParams: Promise<{ candidat?: string }>;
}) {
  const [, { candidat }] = await Promise.all([
    requireRole("admin", "direction"),
    searchParams,
  ]);

  const filterCandidat = candidat ?? "";

  const [initialEvents, actors] = await Promise.all([
    loadEvents({ offset: 0, filterCandidat }),
    getActors(),
  ]);

  const candidateName =
    filterCandidat && initialEvents[0]?.candidateFirstName
      ? `${initialEvents[0].candidateFirstName} ${initialEvents[0].candidateLastName}`
      : null;

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">
          Historique{candidateName ? ` · ${candidateName}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {filterCandidat ? "Activité sur ce candidat" : "Toute l'activité récente"}
        </p>
      </div>

      <HistoriqueClient
        initialEvents={initialEvents}
        actors={actors}
        filterCandidat={filterCandidat}
      />
    </div>
  );
}

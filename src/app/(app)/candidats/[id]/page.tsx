import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function CandidatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;

  const candidat = await db.query.candidates.findFirst({
    where: and(eq(candidates.id, id), isNull(candidates.deletedAt)),
  });

  if (!candidat) notFound();

  return (
    <div className="p-6 max-w-3xl">
      <Link
        href="/annuaire"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à l'annuaire
      </Link>

      <h1 className="text-2xl font-semibold">
        {candidat.firstName} {candidat.lastName}
      </h1>
      <p className="text-sm text-muted-foreground mt-1">Fiche candidat</p>

      <div className="mt-8 rounded-lg border p-6 text-sm text-muted-foreground">
        Fiche en construction — les détails du candidat seront disponibles prochainement.
      </div>
    </div>
  );
}

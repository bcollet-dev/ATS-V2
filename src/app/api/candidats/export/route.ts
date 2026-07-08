import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { candidates, profiles } from "@/db/schema";
import { eq, isNull, asc } from "drizzle-orm";

const STATUS_LABELS: Record<string, string> = {
  to_call:           "À appeler",
  in_progress:       "En cours",
  no_response:       "NRP",
  interview:         "Entretien",
  pvpp:              "PVPP",
  admissible:        "Admissible",
  company_interview: "Entretien entreprise",
  placed:            "Placé",
  waiting_fre:       "Attente FRE",
  temporary_refusal: "Refus temporaire",
  definitive_refusal:"Refus définitif",
  contract_break:    "Rupture",
};

function esc(v: string | null | undefined): string {
  if (!v) return "";
  const s = String(v);
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  await requireAuth();

  const rows = await db
    .select({
      firstName:      candidates.firstName,
      lastName:       candidates.lastName,
      email:          candidates.email,
      phone:          candidates.phone,
      status:         candidates.status,
      cursusEnvisage: candidates.cursusEnvisage,
      city:           candidates.city,
      source:         candidates.source,
      ownerName:      profiles.fullName,
      createdAt:      candidates.createdAt,
    })
    .from(candidates)
    .leftJoin(profiles, eq(candidates.ownerId, profiles.id))
    .where(isNull(candidates.deletedAt))
    .orderBy(asc(candidates.lastName), asc(candidates.firstName));

  const header = [
    "Nom", "Prénom", "Email", "Téléphone",
    "Statut", "Cursus envisagé", "Ville", "Source",
    "Recruteur", "Créé le",
  ].join(";");

  const lines = rows.map((r) => {
    const date = r.createdAt
      ? new Date(r.createdAt).toLocaleDateString("fr-FR")
      : "";
    return [
      esc(r.lastName),
      esc(r.firstName),
      esc(r.email),
      esc(r.phone),
      esc(STATUS_LABELS[r.status] ?? r.status),
      esc(r.cursusEnvisage),
      esc(r.city),
      esc(r.source),
      esc(r.ownerName),
      esc(date),
    ].join(";");
  });

  const BOM = "﻿";
  const csv = BOM + [header, ...lines].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="candidats_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

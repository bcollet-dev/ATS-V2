"use server";

import { requireAuth } from "@/lib/auth";

export type RegistryData = {
  name: string;
  siren: string;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  nafCode: string | null;
  legalForm: string | null;
  employeeRange: string | null;
  administrativeStatus: string | null;
};

export type SiretLookupResult =
  | { found: true; closed: boolean; data: RegistryData }
  | { found: false };

export async function lookupSiret(siret: string): Promise<SiretLookupResult> {
  await requireAuth();
  try {
    const res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(siret)}&per_page=1`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return { found: false };

    const json = await res.json();
    if (!json.results?.length) return { found: false };

    const company = json.results[0];
    // matching_etablissements contient l'établissement qui a matché le SIRET saisi
    // (peut être différent du siège si l'entreprise a plusieurs établissements)
    const etab = company.matching_etablissements?.[0] ?? company.siege;
    const closed =
      etab?.etat_administratif === "F" || company.etat_administratif === "F";

    return {
      found: true,
      closed,
      data: {
        name: company.nom_raison_sociale ?? company.nom_complet ?? "",
        siren: company.siren ?? "",
        address: etab?.adresse ?? null,
        postalCode: etab?.code_postal ?? null,
        city: etab?.libelle_commune ?? null,
        nafCode: etab?.activite_principale ?? null,
        legalForm: company.nature_juridique ?? null,
        employeeRange: company.tranche_effectif_salarie ?? null,
        administrativeStatus: etab?.etat_administratif ?? company.etat_administratif ?? null,
      },
    };
  } catch {
    return { found: false };
  }
}

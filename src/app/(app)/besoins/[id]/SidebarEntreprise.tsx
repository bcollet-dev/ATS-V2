import { db } from "@/db";
import { needs, companies, companyContacts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Building2, AlertTriangle, ExternalLink } from "lucide-react";
import { DeleteEntityButton } from "@/components/entities/DeleteEntityButton";

export async function SidebarEntreprise({ needId, canEdit }: { needId: string; canEdit: boolean }) {
  const [row] = await db
    .select({
      companyId: needs.companyId,
      companyName: companies.name,
      companyDeletedAt: companies.deletedAt,
      companySiret: companies.siret,
      companyAddress: companies.address,
      companyPostalCode: companies.postalCode,
      companyCity: companies.city,
      companyOpco: companies.opco,
      companyCollectiveAgreement: companies.collectiveAgreement,
      companyIdcc: companies.idcc,
      companyRetirementFund: companies.retirementFund,
      companyProvidentFund: companies.providentFund,
      companyLegalRepFirstName: companies.legalRepFirstName,
      companyLegalRepLastName: companies.legalRepLastName,
      contactFirstName: companyContacts.firstName,
      contactLastName: companyContacts.lastName,
      contactJobTitle: companyContacts.jobTitle,
      contactEmail: companyContacts.email,
      contactPhone: companyContacts.phone,
    })
    .from(needs)
    .leftJoin(companies, eq(needs.companyId, companies.id))
    .leftJoin(companyContacts, eq(needs.contactId, companyContacts.id))
    .where(eq(needs.id, needId));

  if (!row) return null;

  const missingLabels: string[] = [];
  if (!row.companyIdcc) missingLabels.push("Code IDCC");
  if (!row.companyCollectiveAgreement) missingLabels.push("Convention collective");
  if (!row.companyOpco) missingLabels.push("OPCO");
  if (!row.companyRetirementFund) missingLabels.push("Caisse de retraite");
  if (!row.companyProvidentFund) missingLabels.push("Organisme de prévoyance");
  if (!row.companyLegalRepFirstName || !row.companyLegalRepLastName) missingLabels.push("Représentant légal");

  const address = [row.companyAddress, row.companyPostalCode, row.companyCity]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="rounded-lg border bg-card text-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <h2 className="font-semibold text-sm">Entreprise</h2>
      </div>

      <div className="px-4 py-3 space-y-2">
        {row.companyName && (
          <p className="font-medium">{row.companyName}</p>
        )}
        {row.companySiret && (
          <p className="text-muted-foreground">SIRET : {row.companySiret}</p>
        )}
        {address && (
          <p className="text-muted-foreground">{address}</p>
        )}
        {row.companyOpco && (
          <p className="text-muted-foreground">OPCO : {row.companyOpco}</p>
        )}
        {row.companyCollectiveAgreement && (
          <p className="text-muted-foreground text-xs">{row.companyCollectiveAgreement}</p>
        )}

        {(row.contactFirstName || row.contactLastName) && (
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs">
            <p className="font-medium text-foreground">Contact contrat</p>
            <p className="text-muted-foreground">
              {[row.contactFirstName, row.contactLastName].filter(Boolean).join(" ")}
              {row.contactJobTitle ? ` · ${row.contactJobTitle}` : ""}
            </p>
            {row.contactEmail && <p className="text-muted-foreground">{row.contactEmail}</p>}
            {row.contactPhone && <p className="text-muted-foreground">{row.contactPhone}</p>}
          </div>
        )}

        <a
          href={`/annuaire/${row.companyId}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
        >
          Voir la fiche entreprise
          <ExternalLink className="h-3 w-3" />
        </a>

        {row.companyDeletedAt ? (
          <p className="text-xs text-destructive">Entreprise supprimee de l&apos;annuaire.</p>
        ) : canEdit && row.companyId && row.companyName ? (
          <div className="pt-1">
            <DeleteEntityButton
              entityType="company"
              entityId={row.companyId}
              label={row.companyName}
              buttonLabel="Supprimer"
              className="h-7"
            />
          </div>
        ) : null}
      </div>

      {missingLabels.length > 0 && (
        <div className="mx-4 mb-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-800">Champs FRE manquants</p>
              <ul className="mt-1 space-y-0.5">
                {missingLabels.map((l) => (
                  <li key={l} className="text-xs text-amber-700">· {l}</li>
                ))}
              </ul>
              <a
                href={`/annuaire/${row.companyId}`}
                className="inline-flex items-center gap-1 text-xs text-amber-700 underline mt-1"
              >
                Compléter la fiche entreprise
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

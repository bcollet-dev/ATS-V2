import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { companyContacts, companies } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function ContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;

  const contact = await db
    .select({
      id: companyContacts.id,
      firstName: companyContacts.firstName,
      lastName: companyContacts.lastName,
      jobTitle: companyContacts.jobTitle,
      phone: companyContacts.phone,
      email: companyContacts.email,
      companyId: companyContacts.companyId,
      companyName: companies.name,
    })
    .from(companyContacts)
    .innerJoin(companies, eq(companyContacts.companyId, companies.id))
    .where(
      and(eq(companyContacts.id, id), isNull(companyContacts.deletedAt))
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!contact) notFound();

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
        {contact.firstName} {contact.lastName}
      </h1>
      <p className="text-sm text-muted-foreground mt-1">
        {contact.jobTitle && `${contact.jobTitle} · `}
        <Link href={`/entreprises/${contact.companyId}`} className="hover:underline">
          {contact.companyName}
        </Link>
      </p>

      <div className="mt-8 rounded-lg border p-6 text-sm text-muted-foreground">
        Fiche en construction — les détails du contact seront disponibles prochainement.
      </div>
    </div>
  );
}

import { requireAuth } from "@/lib/auth";
import { AnnuaireClient } from "./AnnuaireClient";

export default async function AnnuairePage() {
  await requireAuth();
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Annuaire</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Recherchez un candidat, un contact ou une entreprise
        </p>
      </div>
      <AnnuaireClient />
    </div>
  );
}

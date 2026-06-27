import { requireAuth } from "@/lib/auth";
import { getActiveCursus } from "@/app/(app)/cursus/actions";
import { AnnuaireClient } from "./AnnuaireClient";

export default async function AnnuairePage() {
  await requireAuth();
  const cursus = await getActiveCursus();
  return (
    <div className="p-6">
      <AnnuaireClient cursus={cursus} />
    </div>
  );
}

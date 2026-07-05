"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { UserCheck, Loader2 } from "lucide-react";
import { updateCompanyOwner } from "./actions";
import { cn } from "@/lib/utils";

type Profile = { id: string; fullName: string };

const SELECT_CLASS = cn(
  "flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
  "focus:outline-none focus:ring-1 focus:ring-ring"
);

export function BlocConsultantReferent({
  companyId,
  initialOwnerId,
  profiles,
  canEdit,
}: {
  companyId: string;
  initialOwnerId: string | null;
  profiles: Profile[];
  canEdit: boolean;
}) {
  const [ownerId, setOwnerId] = useState(initialOwnerId ?? "");
  const [isSaving, startSave] = useTransition();

  function handleChange(newOwnerId: string) {
    setOwnerId(newOwnerId);
    startSave(async () => {
      const result = await updateCompanyOwner(companyId, newOwnerId || null);
      if (!result.success) {
        toast.error(result.error);
        setOwnerId(initialOwnerId ?? "");
      } else {
        toast.success("Consultant référent mis à jour");
      }
    });
  }

  const ownerProfile = profiles.find((p) => p.id === ownerId);

  return (
    <section className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
        <UserCheck className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Consultant référent</h2>
        {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />}
      </div>
      <div className="px-4 py-3">
        {canEdit ? (
          <select
            value={ownerId}
            onChange={(e) => handleChange(e.target.value)}
            disabled={isSaving}
            className={SELECT_CLASS}
          >
            <option value="">— Non assigné —</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm font-medium">
            {ownerProfile?.fullName ?? (
              <span className="text-muted-foreground/60 italic font-normal">Non assigné</span>
            )}
          </p>
        )}
      </div>
    </section>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, MapPin, MoreHorizontal, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { archiveCompany } from "./actions";

export function CompanyHeader({
  company,
  canDelete,
}: {
  company: {
    id: string;
    name: string;
    city: string | null;
    siret: string | null;
    nafCode: string | null;
    administrativeStatus: string | null;
    deletedAt: string | null;
  };
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isArchiving, startArchive] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isActive =
    company.administrativeStatus &&
    (company.administrativeStatus.toLowerCase().includes("actif") ||
      company.administrativeStatus.toUpperCase() === "A");

  function handleArchive() {
    startArchive(async () => {
      const result = await archiveCompany(company.id);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Entreprise supprimee");
      setConfirmOpen(false);
      setMenuOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex items-start gap-4 mb-8">
      <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
        <Building2 className="h-6 w-6 text-emerald-700" />
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-semibold">{company.name}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
          {company.city && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {company.city}
            </span>
          )}
          {company.siret && <span>SIRET {company.siret}</span>}
          {company.nafCode && <span>NAF {company.nafCode}</span>}
          {company.administrativeStatus && (
            <span
              className={cn(
                "font-medium text-xs px-2 py-0.5 rounded-full",
                isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
              )}
            >
              {company.administrativeStatus}
            </span>
          )}
        </div>
      </div>

      {canDelete && !company.deletedAt && (
        <div className="relative shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-9 z-20 w-48 rounded-lg border bg-popover shadow-lg py-1">
                <button
                  onClick={() => { setMenuOpen(false); setConfirmOpen(true); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer l&apos;entreprise
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Confirm dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-xl border shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold mb-2">Supprimer cette entreprise ?</h3>
            <p className="text-sm text-muted-foreground mb-5">
              L&apos;entreprise sera masquee de l&apos;annuaire et des recherches, mais son historique restera conserve.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmOpen(false)}
                disabled={isArchiving}
              >
                Annuler
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleArchive}
                disabled={isArchiving}
              >
                {isArchiving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Supprimer"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

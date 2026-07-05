"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Briefcase } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NeedDrawer } from "@/app/(app)/besoins/NeedDrawer";
import type { CompanyNeed } from "./actions";

const NEED_STATUS_LABEL: Record<string, string> = {
  ad_chase: "Ad Chase", prospect: "Prospect", need_in_progress: "Besoin en cours",
  a_shooter: "À shooter", cv_envoye: "CV envoyé", interview: "Entretien",
  waiting_fre: "Attente FRE", client: "Client", rupture: "Rupture", lost: "Perdu",
};

const NEED_STATUS_BADGE: Record<string, string> = {
  ad_chase: "bg-slate-100 text-slate-700", prospect: "bg-blue-100 text-blue-700",
  need_in_progress: "bg-violet-100 text-violet-700", a_shooter: "bg-amber-100 text-amber-700",
  cv_envoye: "bg-sky-100 text-sky-700", interview: "bg-orange-100 text-orange-700",
  waiting_fre: "bg-amber-100 text-amber-700", client: "bg-emerald-100 text-emerald-700",
  rupture: "bg-red-100 text-red-700", lost: "bg-gray-100 text-gray-600",
};

export function BlocBesoins({
  companyId,
  initialNeeds,
  companies,
  cursus,
  profiles,
  canEdit,
}: {
  companyId: string;
  companyName: string;
  initialNeeds: CompanyNeed[];
  companies: { id: string; name: string }[];
  cursus: { id: string; name: string }[];
  profiles: { id: string; fullName: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <section className="rounded-lg border-2 border-primary/25 bg-card overflow-hidden shadow-sm">
        <div className="h-1 bg-primary/70" />
        <div className="flex items-center justify-between px-5 py-3.5 border-b bg-primary/[0.03]">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Besoins liés</h2>
            {initialNeeds.length > 0 && (
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {initialNeeds.length}
              </span>
            )}
          </div>
          {canEdit && (
            <Button
              variant="ghost" size="sm" className="gap-1.5 h-7 text-xs"
              onClick={() => setDrawerOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />Nouveau besoin
            </Button>
          )}
        </div>

        {initialNeeds.length === 0 ? (
          <p className="px-5 py-6 text-sm text-center text-muted-foreground italic">Aucun besoin</p>
        ) : (
          <ul className="divide-y">
            {initialNeeds.map((need) => (
              <li
                key={need.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors cursor-pointer"
                onClick={() => router.push(`/besoins/${need.id}`)}
              >
                <span className="text-sm font-medium truncate pr-3">{need.title}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {need.city && (
                    <span className="text-xs text-muted-foreground">{need.city}</span>
                  )}
                  <Link
                    href="/besoins"
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "text-[11px] px-1.5 py-0.5 rounded font-medium hover:opacity-75 transition-opacity",
                      NEED_STATUS_BADGE[need.status] ?? "bg-muted text-muted-foreground"
                    )}
                  >
                    {NEED_STATUS_LABEL[need.status] ?? need.status}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <NeedDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        companies={companies}
        cursus={cursus}
        profiles={profiles}
        defaultCompanyId={companyId}
        onCreated={() => {
          setDrawerOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

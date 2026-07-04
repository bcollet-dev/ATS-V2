"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2, Plus, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInvitation, deleteInvitation, type InvitationRow } from "./actions";
import type { AppRole } from "@/lib/permissions";

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "admissions",            label: "Recruteur (admissions)" },
  { value: "relations_entreprises", label: "Relation entreprise" },
  { value: "team_leader",           label: "Team Leader" },
  { value: "direction",             label: "Direction" },
  { value: "admin",                 label: "Admin" },
];

const ROLE_LABELS: Record<AppRole, string> = {
  admissions:            "Recruteur",
  relations_entreprises: "Relation entreprise",
  team_leader:           "Team Leader",
  direction:             "Direction",
  admin:                 "Admin",
};

const SELECT_CLASS = cn(
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
  "focus:outline-none focus:ring-1 focus:ring-ring"
);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function InvitationsClient({
  initialInvitations,
}: {
  initialInvitations: InvitationRow[];
}) {
  const [invitations, setInvitations] = useState<InvitationRow[]>(initialInvitations);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("admissions");
  const [isSaving, startSave] = useTransition();
  const [deletingEmail, startDelete] = useTransition();
  const [deletingTarget, setDeletingTarget] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startSave(async () => {
      const result = await createInvitation(email, role);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Invitation envoyée à ${email}`);
      const newInvitation: InvitationRow = {
        email: email.trim().toLowerCase(),
        role,
        consumedAt: null,
        createdAt: new Date().toISOString(),
        invitedByName: null,
      };
      setInvitations((prev) => [newInvitation, ...prev]);
      setEmail("");
      setRole("admissions");
    });
  }

  function handleDelete(targetEmail: string) {
    setDeletingTarget(targetEmail);
    startDelete(async () => {
      const result = await deleteInvitation(targetEmail);
      if (!result.success) {
        toast.error(result.error);
        setDeletingTarget(null);
        return;
      }
      setInvitations((prev) => prev.filter((i) => i.email !== targetEmail));
      setDeletingTarget(null);
      toast.success("Invitation supprimée");
    });
  }

  const pending = invitations.filter((i) => !i.consumedAt);
  const consumed = invitations.filter((i) => i.consumedAt);

  return (
    <div className="space-y-8">
      {/* Formulaire nouvelle invitation */}
      <section className="rounded-lg border bg-card">
        <div className="px-5 py-4 border-b">
          <h2 className="text-sm font-semibold">Nouvelle invitation</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            L&apos;utilisateur pourra se connecter via Google avec cet email.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 flex gap-3 items-end flex-wrap">
          <div className="space-y-1.5 flex-1 min-w-52">
            <Label htmlFor="inv-email">Email</Label>
            <Input
              id="inv-email"
              type="email"
              placeholder="prenom.nom@eda-rh.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5 w-52">
            <Label htmlFor="inv-role">Rôle</Label>
            <select
              id="inv-role"
              value={role}
              onChange={(e) => setRole(e.target.value as AppRole)}
              className={SELECT_CLASS}
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={isSaving} className="gap-1.5">
            {isSaving
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Plus className="h-3.5 w-3.5" />
            }
            Inviter
          </Button>
        </form>
      </section>

      {/* Invitations en attente */}
      <section className="rounded-lg border bg-card">
        <div className="px-5 py-3.5 border-b flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold">
            En attente
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground min-w-[1.25rem]">
              {pending.length}
            </span>
          </h2>
        </div>

        {pending.length === 0 ? (
          <p className="px-5 py-6 text-sm text-center text-muted-foreground">
            Aucune invitation en attente.
          </p>
        ) : (
          <div className="divide-y">
            {pending.map((inv) => (
              <div key={inv.email} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{inv.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ROLE_LABELS[inv.role]}
                    {inv.invitedByName && <> · invité par {inv.invitedByName}</>}
                    {" · "}{formatDate(inv.createdAt)}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 shrink-0">
                  <Clock className="h-3 w-3" />
                  En attente
                </span>
                <button
                  onClick={() => handleDelete(inv.email)}
                  disabled={deletingTarget === inv.email}
                  className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 disabled:opacity-40"
                  title="Supprimer l'invitation"
                >
                  {deletingTarget === inv.email
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />
                  }
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Invitations utilisées */}
      {consumed.length > 0 && (
        <section className="rounded-lg border bg-card">
          <div className="px-5 py-3.5 border-b flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <h2 className="text-sm font-semibold">
              Utilisées
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground min-w-[1.25rem]">
                {consumed.length}
              </span>
            </h2>
          </div>
          <div className="divide-y">
            {consumed.map((inv) => (
              <div key={inv.email} className="flex items-center gap-4 px-5 py-3 opacity-70">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{inv.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ROLE_LABELS[inv.role]}
                    {inv.invitedByName && <> · invité par {inv.invitedByName}</>}
                    {" · "}{formatDate(inv.createdAt)}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 shrink-0">
                  <CheckCircle2 className="h-3 w-3" />
                  Connecté
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

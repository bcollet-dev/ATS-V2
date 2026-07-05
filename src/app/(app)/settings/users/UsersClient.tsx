"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/permissions";
import { startPreview, startRolePreview } from "./preview-actions";
import { Eye } from "lucide-react";

const ROLE_LABELS: Record<AppRole, string> = {
  admin:                 "Admin",
  direction:             "Direction",
  team_leader:           "Team Leader",
  admissions:            "Recruteur",
  relations_entreprises: "Relation entreprise",
};

const ROLE_BADGE: Record<AppRole, string> = {
  admin:                 "bg-violet-100 text-violet-700",
  direction:             "bg-blue-100 text-blue-700",
  team_leader:           "bg-sky-100 text-sky-700",
  admissions:            "bg-amber-100 text-amber-700",
  relations_entreprises: "bg-emerald-100 text-emerald-700",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

type UserRow = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  active: boolean;
  createdAt: string;
};

const ROLE_PREVIEW_OPTIONS: { role: string; label: string }[] = [
  { role: "admissions",            label: "Recruteur" },
  { role: "relations_entreprises", label: "Relation entreprise" },
  { role: "team_leader",           label: "Team Leader" },
  { role: "direction",             label: "Direction" },
];

export function UsersClient({
  users,
  currentUserId,
  isAdmin,
}: {
  users: UserRow[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  return (
    <div className="space-y-6">
    {isAdmin && (
      <section className="rounded-lg border bg-card">
        <div className="px-5 py-3.5 border-b">
          <p className="text-sm font-semibold">Prévisualiser un rôle</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Voir l'interface telle qu'elle apparaît pour ce rôle.
          </p>
        </div>
        <div className="px-5 py-4 flex flex-wrap gap-2">
          {ROLE_PREVIEW_OPTIONS.map(({ role, label }) => (
            <form key={role} action={startRolePreview.bind(null, role)}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                {label}
              </button>
            </form>
          ))}
        </div>
      </section>
    )}
    <section className="rounded-lg border bg-card divide-y">
      {users.length === 0 && (
        <p className="px-5 py-6 text-sm text-center text-muted-foreground">Aucun utilisateur.</p>
      )}
      {users.map((u) => {
        const initials = u.fullName
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2) || "?";
        const role = u.role as AppRole;
        return (
          <div
            key={u.id}
            className={cn("flex items-center gap-4 px-5 py-3", !u.active && "opacity-50")}
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="text-xs bg-[var(--color-eda-rh)] text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {u.fullName}
                {u.id === currentUserId && (
                  <span className="ml-1.5 text-xs text-muted-foreground">(vous)</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
            </div>
            <span className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0",
              ROLE_BADGE[role] ?? "bg-muted text-muted-foreground"
            )}>
              {ROLE_LABELS[role] ?? role}
            </span>
            <span className="text-xs text-muted-foreground shrink-0 w-20 text-right">
              {formatDate(u.createdAt)}
            </span>
            {isAdmin && u.id !== currentUserId && u.role !== "admin" && (
              <form action={startPreview.bind(null, u.id)}>
                <button
                  type="submit"
                  title={`Prévisualiser en tant que ${u.fullName}`}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Voir comme</span>
                </button>
              </form>
            )}
          </div>
        );
      })}
    </section>
    </div>
  );
}

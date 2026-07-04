"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/permissions";

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

export function UsersClient({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  return (
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
          </div>
        );
      })}
    </section>
  );
}

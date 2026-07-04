"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { navItems, adminNavItems, superAdminNavItems } from "./nav-items";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Mail, Pencil } from "lucide-react";
import { signOut } from "@/app/(auth)/login/actions";
import { NotificationBell } from "./NotificationBell";
import { EditNameModal } from "@/app/(app)/onboarding/EditNameModal";
import type { profiles } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

type Profile = InferSelectModel<typeof profiles>;

const ROLE_LABELS: Record<Profile["role"], string> = {
  admin: "Admin",
  direction: "Direction",
  team_leader: "Team Leader",
  admissions: "Recruteur",
  relations_entreprises: "Relation entreprise",
};

export function AppShell({
  user,
  unreadCount,
  children,
}: {
  user: Profile;
  unreadCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = user.role === "admin" || user.role === "direction";
  const isSuperAdmin = user.role === "admin";
  const [editNameOpen, setEditNameOpen] = useState(false);
  const gmailConnectHref = `/auth/gmail/connect?next=${encodeURIComponent(pathname || "/dashboard")}`;
  const mobileNavItems = [
    ...navItems,
    ...(isAdmin ? adminNavItems : []),
    ...(isSuperAdmin ? superAdminNavItems : []),
  ];
  const activeMobileItem =
    mobileNavItems.find((item) => pathname === item.href || pathname.startsWith(item.href + "/")) ??
    mobileNavItems[0];

  const initials = user.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="hidden w-56 flex-col border-r bg-sidebar lg:flex">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 px-4 border-b">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-eda-rh)] text-white text-xs font-bold">
            E
          </div>
          <span className="text-sm font-semibold tracking-tight">EDA Groupe</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}

          {isAdmin && (
            <>
              <Separator className="my-2" />
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}

          {isSuperAdmin && (
            <>
              <Separator className="my-2" />
              {superAdminNavItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="border-t p-2">
          <div className="flex items-center gap-1 mb-1">
            <DropdownMenu>
            <DropdownMenuTrigger
              id="app-shell-user-menu-trigger"
              className="flex flex-1 min-w-0 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-sidebar-accent/50 transition-colors"
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs bg-[var(--color-eda-rh)] text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0 group/name">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-medium truncate">{user.fullName}</p>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setEditNameOpen(true); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setEditNameOpen(true); } }}
                    className="opacity-0 group-hover/name:opacity-100 transition-opacity rounded p-0.5 hover:bg-sidebar-accent cursor-pointer"
                  >
                    <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {ROLE_LABELS[user.role]}
                </p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem disabled>
                <span className="text-xs text-muted-foreground">{user.email}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <form action={signOut} className="w-full">
                  <button type="submit" className="w-full text-left text-sm">
                    Se deconnecter
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
            <NotificationBell unreadCount={unreadCount} />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto pb-20 lg:pb-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background px-4 lg:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-eda-rh)] text-sm font-bold text-white">
              E
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">EDA Groupe</p>
              <p className="truncate text-xs text-muted-foreground">{activeMobileItem?.label ?? "ATS"}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <NotificationBell unreadCount={unreadCount} />
            <DropdownMenu>
              <DropdownMenuTrigger
                id="app-shell-mobile-user-menu-trigger"
                className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-sidebar-accent/50"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-[var(--color-eda-rh)] text-xs text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem disabled>
                  <span className="min-w-0 truncate text-xs text-muted-foreground">{user.email}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEditNameOpen(true)}>
                  Modifier mon nom
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <form action={signOut} className="w-full">
                    <button type="submit" className="w-full text-left text-sm">
                      Se deconnecter
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {!user.googleRefreshToken && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 sm:px-6 sm:py-2.5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 min-w-0 text-amber-900">
                <Mail className="h-4 w-4 shrink-0" />
                <p className="text-sm sm:truncate">
                  Gmail n'est pas connecte. Activez-le pour envoyer des emails depuis l'ATS.
                </p>
              </div>
              <a
                href={gmailConnectHref}
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-amber-900 px-3 text-xs font-medium text-white transition-colors hover:bg-amber-800 sm:h-8"
              >
                Connecter Gmail
              </a>
            </div>
          </div>
        )}
        <div className="min-h-0 flex-1">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.04)] backdrop-blur lg:hidden">
        <div className="flex overflow-x-auto px-2 py-1.5">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className={cn(
                  "flex h-14 min-w-[72px] flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="max-w-[64px] truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <EditNameModal
        open={editNameOpen}
        onClose={() => setEditNameOpen(false)}
        currentName={user.fullName}
      />
    </div>
  );
}

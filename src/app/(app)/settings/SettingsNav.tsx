"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { UserPlus, Users, Bell, ShieldCheck } from "lucide-react";

function NavLink({
  href,
  label,
  icon: Icon,
}: {
  href: "/settings/invitations" | "/settings/users" | "/settings/notifications" | "/settings/rgpd";
  label: string;
  icon: React.ElementType;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

export function SettingsNav() {
  return (
    <aside className="w-52 shrink-0 border-r bg-muted/30 p-3 space-y-0.5">
      <p className="px-2.5 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
        Paramètres
      </p>
      <NavLink href="/settings/invitations" label="Invitations" icon={UserPlus} />
      <NavLink href="/settings/users" label="Utilisateurs" icon={Users} />
      <NavLink href="/settings/notifications" label="Notifications" icon={Bell} />
      <NavLink href="/settings/rgpd" label="RGPD" icon={ShieldCheck} />
    </aside>
  );
}

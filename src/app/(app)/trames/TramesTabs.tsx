"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mail, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/trames/mail", label: "Trames mail", icon: Mail },
  { href: "/trames/entretien", label: "Trames d'entretien", icon: ClipboardList },
] as const;

export function TramesTabs() {
  const pathname = usePathname();
  return (
    <div className="border-b px-6 pt-4">
      <div className="flex items-center gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

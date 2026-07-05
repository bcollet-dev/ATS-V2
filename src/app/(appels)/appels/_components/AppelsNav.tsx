"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Phone, Clock } from "lucide-react";

const tabs = [
  { href: "/appels/annuaire", label: "Annuaire", icon: Phone },
  { href: "/appels/relances", label: "Relances", icon: Clock },
];

export default function AppelsNav() {
  const pathname = usePathname();

  return (
    <nav className="shrink-0 border-t border-gray-200 bg-white">
      <div className="flex">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href as never}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                active
                  ? "text-[var(--color-eda-orange)]"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

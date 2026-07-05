"use client";

import { useTransition } from "react";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { completeRelance, type RelanceRow } from "../actions";

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

function contactName(r: RelanceRow) {
  if (r.candidateFirstName && r.candidateLastName) {
    return `${r.candidateFirstName} ${r.candidateLastName}`;
  }
  if (r.companyName) return r.companyName;
  return r.title.replace(/^Relance — /, "");
}

export function RelancesClient({ relances }: { relances: RelanceRow[] }) {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const past = relances.filter((r) => new Date(r.dueAt) < today);
  const todayItems = relances.filter(
    (r) => new Date(r.dueAt) >= today && new Date(r.dueAt) < tomorrow,
  );
  const upcoming = relances.filter((r) => new Date(r.dueAt) >= tomorrow);

  if (relances.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-gray-300">
        <CheckCircle2 className="mb-3 h-12 w-12" />
        <p className="text-sm text-gray-400">Aucune relance en cours</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 py-4">
      {past.length > 0 && (
        <Section
          title="En retard"
          icon={<AlertCircle className="h-4 w-4 text-red-500" />}
          items={past}
          variant="past"
        />
      )}
      {todayItems.length > 0 && (
        <Section
          title="Aujourd'hui"
          icon={<Clock className="h-4 w-4 text-[var(--color-eda-orange)]" />}
          items={todayItems}
          variant="today"
        />
      )}
      {upcoming.length > 0 && (
        <Section
          title="À venir"
          icon={<Clock className="h-4 w-4 text-gray-400" />}
          items={upcoming}
          variant="upcoming"
        />
      )}
    </div>
  );
}

function Section({
  title,
  icon,
  items,
  variant,
}: {
  title: string;
  icon: React.ReactNode;
  items: RelanceRow[];
  variant: "past" | "today" | "upcoming";
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {title}
        </span>
        <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
          {items.length}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((r) => (
          <RelanceCard key={r.id} relance={r} variant={variant} />
        ))}
      </div>
    </div>
  );
}

function RelanceCard({
  relance,
  variant,
}: {
  relance: RelanceRow;
  variant: "past" | "today" | "upcoming";
}) {
  const [isPending, startTransition] = useTransition();
  const name = contactName(relance);

  const handleDone = () => {
    startTransition(async () => {
      await completeRelance(relance.id);
    });
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm ${
        variant === "past" ? "border-red-100" : "border-gray-100"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-gray-900">{name}</p>
        <p
          className={`text-xs ${variant === "past" ? "text-red-500" : "text-gray-400"}`}
        >
          {formatDate(new Date(relance.dueAt))}
        </p>
      </div>
      <button
        onClick={handleDone}
        disabled={isPending}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-gray-200 text-gray-300 transition-all hover:border-green-400 hover:text-green-500 active:scale-90 disabled:opacity-50"
        title="Marquer effectuée"
      >
        <CheckCircle2 className="h-5 w-5" />
      </button>
    </div>
  );
}

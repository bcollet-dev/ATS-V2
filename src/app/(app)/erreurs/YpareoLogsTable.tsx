"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { replayYpareoPlacement } from "@/app/(app)/ypareo/actions";

export type YpareoLogRow = {
  id: string;
  createdAt: string;
  candidateName: string | null;
  candidateId: string | null;
  operation: string;
  status: string;
  errorMessage: string | null;
  responseStatus: number | null;
  retryable: boolean;
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-amber-50 text-amber-700" },
  success: { label: "Succès",    className: "bg-emerald-50 text-emerald-700" },
  error:   { label: "Erreur",    className: "bg-red-50 text-red-600" },
};

function ReplayButton({ logId }: { logId: string }) {
  const router = useRouter();
  const [isReplaying, startReplay] = useTransition();

  function handleReplay(e: React.MouseEvent) {
    e.stopPropagation();
    startReplay(async () => {
      const result = await replayYpareoPlacement(logId);
      if (!result.success) {
        toast.error(result.error ?? "Échec du rejeu");
        return;
      }
      toast.success("Envoi Ypareo rejoué avec succès");
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleReplay}
      disabled={isReplaying}
      className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
      title="Reconstruire le dossier depuis les fiches actuelles et relancer l'envoi"
    >
      {isReplaying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
      Rejouer
    </button>
  );
}

function LogRow({ log }: { log: YpareoLogRow }) {
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[log.status] ?? STATUS_META.pending;
  const canReplay = log.status === "error" && log.retryable && log.operation === "placement";

  return (
    <>
      <tr
        className={cn("hover:bg-muted/40 transition-colors", log.errorMessage && "cursor-pointer")}
        onClick={() => log.errorMessage && setExpanded((p) => !p)}
      >
        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
          {new Date(log.createdAt).toLocaleString("fr-FR", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </td>
        <td className="px-4 py-3 text-sm">
          {log.candidateName ? (
            <a
              href={`/candidats/${log.candidateId}`}
              className="hover:underline text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              {log.candidateName}
            </a>
          ) : (
            <span className="text-muted-foreground italic">–</span>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{log.operation}</td>
        <td className="px-4 py-3">
          <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", meta.className)}>
            {meta.label}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">{log.responseStatus ?? "–"}</td>
        <td className="px-4 py-3 whitespace-nowrap">
          {canReplay && <ReplayButton logId={log.id} />}
        </td>
        <td className="px-4 py-3 text-xs w-6">
          {log.errorMessage && (
            expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </td>
      </tr>
      {expanded && log.errorMessage && (
        <tr>
          <td colSpan={7} className="px-4 pb-3 pt-0">
            <pre className="text-xs bg-muted rounded-md p-3 whitespace-pre-wrap break-words text-destructive font-mono">
              {log.errorMessage}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

export function YpareoLogsTable({ logs }: { logs: YpareoLogRow[] }) {
  const [filter, setFilter] = useState<"all" | "success" | "error">("all");
  const filtered = filter === "all" ? logs : logs.filter((l) => l.status === filter);

  return (
    <div>
      <div className="flex items-center gap-1 rounded-lg border p-1 bg-muted/40 w-fit mb-4">
        {(["all", "success", "error"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              filter === s ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s === "all" ? "Tous" : s === "success" ? "Succès" : "Erreurs"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border bg-card px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">Aucun log Ypareo</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Candidat</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Opération</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">HTTP</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Action</th>
                <th className="px-4 py-2.5 w-6" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((log) => (
                <LogRow key={log.id} log={log} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

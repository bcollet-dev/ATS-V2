"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Play, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Modal, ModalBody, ModalClose, ModalContent, ModalFooter, ModalHeader, ModalTitle,
} from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { getMyTasksData, type MyTaskRow } from "@/app/(app)/dashboard/widget-actions";
import { markInterviewNoShow } from "@/app/(app)/entretiens/actions";
import { StartInterviewModal } from "@/components/entretiens/StartInterviewModal";

const CATEGORY_LABELS: Record<string, string> = {
  call: "Appel", email: "Email", document: "Document",
  follow_up: "Relance", interview: "Entretien", other: "Autre",
  video_interview: "Visio", onsite_interview: "Sur site", administrative: "Administratif",
};

const INTERVIEW_CATEGORIES = new Set(["interview", "video_interview", "onsite_interview"]);

function formatDue(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function WidgetMesTaches() {
  const router = useRouter();
  const [data, setData] = useState<MyTaskRow[] | null>(null);
  const [category, setCategory] = useState("");
  const [startTarget, setStartTarget] = useState<MyTaskRow | null>(null);
  const [noShowTarget, setNoShowTarget] = useState<MyTaskRow | null>(null);
  const [isNoShowing, startNoShow] = useTransition();

  const reload = useCallback(() => {
    getMyTasksData().then(setData);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  function handleNoShow() {
    if (!noShowTarget?.candidateId) return;
    const target = noShowTarget;
    startNoShow(async () => {
      const result = await markInterviewNoShow({
        candidateId: target.candidateId!,
        taskId: target.id,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.pvppApplied
          ? "Candidat passé en PVPP, tâche clôturée"
          : "Tâche clôturée (statut du candidat inchangé)"
      );
      setNoShowTarget(null);
      reload();
      router.refresh();
    });
  }

  if (data === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const categories = [...new Set(data.map((t) => t.category))];
  const filtered = category ? data.filter((t) => t.category === category) : data;
  const now = Date.now();

  return (
    <div className="flex h-full flex-col gap-2">
      {startTarget?.candidateId && (
        <StartInterviewModal
          open={!!startTarget}
          onOpenChange={(open) => {
            if (!open) {
              setStartTarget(null);
              reload();
            }
          }}
          candidateId={startTarget.candidateId}
          candidateName={startTarget.candidateName ?? ""}
          taskId={startTarget.id}
        />
      )}

      <div className="flex shrink-0 items-center justify-between gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={cn(
            "h-7 rounded-md border border-input bg-transparent px-2 text-xs shadow-xs",
            "focus:outline-none focus:ring-1 focus:ring-ring"
          )}
        >
          <option value="">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          {filtered.length} tâche{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Aucune tâche ouverte 🎉
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {filtered.map((task) => {
            const overdue = new Date(task.dueAt).getTime() < now;
            const isInterviewTask = INTERVIEW_CATEGORIES.has(task.category) && !!task.candidateId;
            return (
              <div key={task.id} className="rounded-md border bg-card px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="rounded bg-muted px-1 py-0.5">
                        {CATEGORY_LABELS[task.category] ?? task.category}
                      </span>
                      <span className={overdue ? "font-medium text-destructive" : ""}>
                        {formatDue(task.dueAt)}
                      </span>
                      {task.candidateId && (
                        <Link href={`/candidats/${task.candidateId}`} className="truncate hover:underline">
                          {task.candidateName}
                        </Link>
                      )}
                    </div>
                  </div>
                  {isInterviewTask && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => setStartTarget(task)}
                      >
                        <Play className="h-3 w-3" />
                        Démarrer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => setNoShowTarget(task)}
                      >
                        <UserX className="h-3 w-3" />
                        Non présent
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={noShowTarget !== null} onOpenChange={(open) => { if (!open && !isNoShowing) setNoShowTarget(null); }}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle>Candidat non présent ?</ModalTitle>
            <ModalClose />
          </ModalHeader>
          <ModalBody>
            <p className="text-sm">
              <span className="font-medium">{noShowTarget?.candidateName}</span> ne s'est pas
              présenté à l'entretien.
            </p>
            <p className="text-sm text-muted-foreground">
              {noShowTarget?.candidateStatus === "interview"
                ? "Le candidat passera en PVPP et la tâche sera clôturée."
                : "La tâche sera clôturée ; le candidat n'étant pas au statut « Entretien EDA », son statut ne change pas."}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setNoShowTarget(null)} disabled={isNoShowing}>
              Annuler
            </Button>
            <Button type="button" onClick={handleNoShow} disabled={isNoShowing}>
              {isNoShowing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
              Confirmer
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

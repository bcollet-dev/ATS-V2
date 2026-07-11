"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Modal, ModalBody, ModalClose, ModalContent, ModalFooter, ModalHeader, ModalTitle,
} from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import {
  listTramesForCandidate,
  startInterview,
  type TrameOption,
} from "@/app/(app)/entretiens/actions";

const SELECT_CLASS = cn(
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
  "focus:outline-none focus:ring-1 focus:ring-ring"
);

// Choix de la trame puis démarrage de l'entretien. La trame correspondant au
// cursus envisagé du candidat est présélectionnée ; le recruteur reste libre.
export function StartInterviewModal({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  taskId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
  taskId?: string;
}) {
  const router = useRouter();
  const [trames, setTrames] = useState<TrameOption[] | null>(null);
  const [trameId, setTrameId] = useState("");
  const [isStarting, startStart] = useTransition();

  useEffect(() => {
    if (!open) return;
    setTrames(null);
    listTramesForCandidate(candidateId).then((options) => {
      setTrames(options);
      setTrameId(options[0]?.id ?? "");
    });
  }, [open, candidateId]);

  function handleStart() {
    if (!trameId) return;
    startStart(async () => {
      const result = await startInterview({ candidateId, trameId, taskId });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onOpenChange(false);
      router.push(`/entretiens/${result.interviewId}`);
    });
  }

  return (
    <Modal open={open} onOpenChange={(o) => { if (!isStarting) onOpenChange(o); }}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle>Démarrer l'entretien</ModalTitle>
          <ModalClose />
        </ModalHeader>
        <ModalBody>
          <p className="text-sm">
            Entretien avec <span className="font-medium">{candidateName}</span>
          </p>
          {trames === null ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : trames.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune trame d'entretien active. La direction doit d'abord en créer une dans
              l'onglet Trames.
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="start-trame">Trame d'entretien</Label>
              <select
                id="start-trame"
                value={trameId}
                onChange={(e) => setTrameId(e.target.value)}
                className={SELECT_CLASS}
              >
                {trames.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.subcategory}
                    {t.cursusName ? ` (${t.cursusName})` : " (générique)"}
                    {t.matchesCandidateCursus ? " ★" : ""}
                  </option>
                ))}
              </select>
              {trames.some((t) => t.matchesCandidateCursus) && (
                <p className="text-xs text-muted-foreground">
                  ★ trame du cursus envisagé par le candidat (présélectionnée)
                </p>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isStarting}>
            Annuler
          </Button>
          <Button type="button" onClick={handleStart} disabled={isStarting || !trameId}>
            {isStarting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Démarrer
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarClock, Loader2, MapPin, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Modal, ModalBody, ModalClose, ModalContent, ModalFooter, ModalHeader, ModalTitle,
} from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { scheduleInterviewTask } from "@/app/(app)/entretiens/actions";

const SELECT_CLASS = cn(
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
  "focus:outline-none focus:ring-1 focus:ring-ring"
);

// Demain à 10h, au format attendu par <input type="datetime-local">
function defaultDateTime(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Planification de l'entretien EDA au moment où le candidat passe au statut
// « Entretien » : date/heure, visio ou présentiel, assigné (utilisateur courant
// par défaut). Crée la tâche qui alimente le widget « Mes tâches ».
export function ScheduleInterviewModal({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  profiles,
  currentUserId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
  profiles: { id: string; fullName: string }[];
  currentUserId: string;
}) {
  const [dueAt, setDueAt] = useState(defaultDateTime());
  const [mode, setMode] = useState<"visio" | "presentiel">("visio");
  const [assignedTo, setAssignedTo] = useState(currentUserId);
  const [isSaving, startSave] = useTransition();

  useEffect(() => {
    if (open) {
      setDueAt(defaultDateTime());
      setMode("visio");
      setAssignedTo(currentUserId);
    }
  }, [open, currentUserId]);

  function handleConfirm() {
    const date = new Date(dueAt);
    if (Number.isNaN(date.getTime())) {
      toast.error("Renseignez la date et l'heure de l'entretien");
      return;
    }
    startSave(async () => {
      const result = await scheduleInterviewTask({
        candidateId,
        dueAt: date.toISOString(),
        mode,
        assignedTo,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Entretien planifié — visible dans le widget Mes tâches");
      onOpenChange(false);
    });
  }

  return (
    <Modal open={open} onOpenChange={(o) => { if (!isSaving) onOpenChange(o); }}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle>Planifier l'entretien</ModalTitle>
          <ModalClose />
        </ModalHeader>
        <ModalBody>
          <p className="text-sm">
            <span className="font-medium">{candidateName}</span> passe au statut « Entretien EDA ».
            Quand a lieu l'entretien ?
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="schedule-date">Date et heure</Label>
            <input
              id="schedule-date"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className={SELECT_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Format</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "visio" ? "default" : "outline"}
                className="flex-1 gap-1.5"
                onClick={() => setMode("visio")}
              >
                <Video className="h-4 w-4" />
                Visio
              </Button>
              <Button
                type="button"
                variant={mode === "presentiel" ? "default" : "outline"}
                className="flex-1 gap-1.5"
                onClick={() => setMode("presentiel")}
              >
                <MapPin className="h-4 w-4" />
                Présentiel
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="schedule-assignee">Assigné à</Label>
            <select
              id="schedule-assignee"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className={SELECT_CLASS}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                  {p.id === currentUserId ? " (moi)" : ""}
                </option>
              ))}
            </select>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Passer
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
            Planifier
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

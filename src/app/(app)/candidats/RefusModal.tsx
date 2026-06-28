"use client";

import { useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type RefusType = "temporary_refusal" | "definitive_refusal";

const LABELS: Record<RefusType, { title: string; color: string }> = {
  temporary_refusal: { title: "Refus temporaire", color: "text-foreground" },
  definitive_refusal: { title: "Refus définitif", color: "text-destructive" },
};

export function RefusModal({
  open,
  refusType,
  candidateName,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  refusType: RefusType | null;
  candidateName: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);

  function handleConfirm() {
    if (!reason.trim()) {
      setError(true);
      return;
    }
    const val = reason.trim();
    setReason("");
    setError(false);
    onConfirm(val);
  }

  function handleCancel() {
    setReason("");
    setError(false);
    onCancel();
  }

  if (!refusType) return null;

  const meta = LABELS[refusType];

  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) handleCancel(); }}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle className={meta.color}>{meta.title}</ModalTitle>
        </ModalHeader>
        <ModalBody className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Raison du refus pour <span className="font-medium text-foreground">{candidateName}</span>
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="refus-reason">
              Motif <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="refus-reason"
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(false); }}
              placeholder="Ex : profil ne correspond pas au niveau requis, candidat a trouvé autre chose…"
              className="flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              autoFocus
            />
            {error && (
              <p className="text-xs text-destructive">Le motif est obligatoire.</p>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={handleCancel}>Annuler</Button>
          <Button
            variant={refusType === "definitive_refusal" ? "destructive" : "default"}
            onClick={handleConfirm}
          >
            Confirmer le {refusType === "definitive_refusal" ? "refus définitif" : "refus temporaire"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

"use client";

import { useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function RuptureModal({
  open,
  needTitle,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  needTitle: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);

  function handleConfirm() {
    if (!reason.trim()) { setError(true); return; }
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

  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) handleCancel(); }}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle className="text-destructive">Rupture</ModalTitle>
        </ModalHeader>
        <ModalBody className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Motif de rupture pour <span className="font-medium text-foreground">{needTitle}</span>
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="rupture-reason">
              Motif <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="rupture-reason"
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(false); }}
              placeholder="Ex : poste pourvu en interne, abandon de recrutement…"
              className="flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              autoFocus
            />
            {error && <p className="text-xs text-destructive">Le motif est obligatoire.</p>}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={handleCancel}>Annuler</Button>
          <Button variant="destructive" onClick={handleConfirm}>Confirmer la rupture</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

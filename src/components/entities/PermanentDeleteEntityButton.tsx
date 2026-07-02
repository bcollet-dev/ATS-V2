"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalBody,
  ModalClose,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { permanentlyDeleteCandidate } from "@/app/(app)/candidats/[id]/actions";
import { permanentlyDeleteNeed } from "@/app/(app)/besoins/actions";

type PermanentDeleteEntityButtonProps = {
  entityType: "candidate" | "need";
  entityId: string;
  label: string;
  iconOnly?: boolean;
  onDeleted?: () => void;
  className?: string;
};

export function PermanentDeleteEntityButton({
  entityType,
  entityId,
  label,
  iconOnly = false,
  onDeleted,
  className,
}: PermanentDeleteEntityButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isCandidate = entityType === "candidate";

  function handleConfirm() {
    startTransition(async () => {
      const result = isCandidate
        ? await permanentlyDeleteCandidate(entityId)
        : await permanentlyDeleteNeed(entityId);

      if (!result.success) {
        toast.error(result.error ?? "Suppression definitive impossible");
        return;
      }

      toast.success(isCandidate ? "Candidat supprime definitivement" : "Besoin supprime definitivement");
      setOpen(false);
      onDeleted?.();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={iconOnly ? "ghost" : "destructive"}
        size={iconOnly ? "icon-sm" : "sm"}
        className={cn(
          iconOnly && "text-destructive hover:bg-destructive/10 hover:text-destructive",
          className
        )}
        onClick={() => setOpen(true)}
        disabled={isPending}
        title={`Supprimer definitivement ${label}`}
        aria-label={`Supprimer definitivement ${label}`}
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        {!iconOnly && "Supprimer definitivement"}
      </Button>

      <Modal open={open} onOpenChange={(nextOpen) => { if (!isPending) setOpen(nextOpen); }}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle>
              {isCandidate ? "Supprimer definitivement ce candidat ?" : "Supprimer definitivement ce besoin ?"}
            </ModalTitle>
            <ModalClose />
          </ModalHeader>
          <ModalBody>
            <p className="text-sm">
              Vous allez supprimer definitivement <span className="font-medium">{label}</span>.
            </p>
            <p className="text-sm text-destructive">
              Cette action efface la fiche et les donnees rattachees. Elle ne pourra pas etre annulee.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Annuler
            </Button>
            <Button type="button" variant="destructive" onClick={handleConfirm} disabled={isPending}>
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Supprimer
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import type { MouseEvent } from "react";
import { useRouter } from "next/navigation";
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
import { deleteCandidate } from "@/app/(app)/candidats/[id]/actions";
import { archiveCompany } from "@/app/(app)/annuaire/[id]/actions";

type DeleteEntityButtonProps = {
  entityType: "candidate" | "company";
  entityId: string;
  label: string;
  buttonLabel?: string;
  iconOnly?: boolean;
  redirectTo?: string;
  onDeleted?: () => void;
  className?: string;
  stopPropagation?: boolean;
  disabled?: boolean;
};

export function DeleteEntityButton({
  entityType,
  entityId,
  label,
  buttonLabel = "Supprimer",
  iconOnly = false,
  redirectTo,
  onDeleted,
  className,
  stopPropagation = false,
  disabled = false,
}: DeleteEntityButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const modalTitle = entityType === "candidate" ? "Supprimer ce candidat ?" : "Supprimer cette entreprise ?";

  function openConfirm(event: MouseEvent<HTMLButtonElement>) {
    if (stopPropagation) {
      event.preventDefault();
      event.stopPropagation();
    }
    setOpen(true);
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = entityType === "candidate"
        ? await deleteCandidate(entityId)
        : await archiveCompany(entityId);

      if (!result.success) {
        toast.error(result.error ?? "Suppression impossible");
        return;
      }

      toast.success(entityType === "candidate" ? "Candidat supprime" : "Entreprise supprimee");
      setOpen(false);
      onDeleted?.();

      if (redirectTo) {
        router.push(redirectTo as Parameters<typeof router.push>[0]);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={iconOnly ? "ghost" : "outline"}
        size={iconOnly ? "icon-sm" : "sm"}
        className={cn(
          "text-destructive hover:text-destructive",
          iconOnly && "hover:bg-destructive/10",
          className
        )}
        onClick={openConfirm}
        disabled={disabled || isPending}
        title={`Supprimer ${label}`}
        aria-label={`Supprimer ${label}`}
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        {!iconOnly && buttonLabel}
      </Button>

      <Modal open={open} onOpenChange={(nextOpen) => { if (!isPending) setOpen(nextOpen); }}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle>{modalTitle}</ModalTitle>
            <ModalClose />
          </ModalHeader>
          <ModalBody>
            <p className="text-sm">
              Vous allez supprimer <span className="font-medium">{label}</span>.
            </p>
            <p className="text-sm text-muted-foreground">
              {entityType === "candidate"
                ? "Le candidat sera masque des pipelines, du matching et des recherches, tout en conservant son historique."
                : "L'entreprise sera masquee de l'annuaire et des recherches, tout en conservant son historique."
              }
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

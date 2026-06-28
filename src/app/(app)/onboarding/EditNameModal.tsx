"use client";

import { useRef, useState, useTransition } from "react";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmName } from "./actions";

export function EditNameModal({
  open,
  onClose,
  currentName,
}: {
  open: boolean;
  onClose: () => void;
  currentName: string;
}) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(formRef.current!);
    startTransition(async () => {
      const result = await confirmName(fd);
      if (result?.error) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  }

  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle>Modifier le nom affiché</ModalTitle>
        </ModalHeader>
        <form ref={formRef} onSubmit={handleSubmit}>
          <ModalBody>
            <div className="space-y-1.5">
              <Label htmlFor="editFullName">Nom affiché</Label>
              <Input
                id="editFullName"
                name="fullName"
                defaultValue={currentName}
                autoFocus
                autoComplete="off"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

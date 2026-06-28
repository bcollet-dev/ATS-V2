"use client";

import { useRef, useState, useTransition } from "react";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmName } from "./actions";

export function ConfirmNameModal({ defaultName }: { defaultName: string }) {
  const [open, setOpen] = useState(true);
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
        setOpen(false);
      }
    });
  }

  return (
    <Modal open={open} onOpenChange={() => {}}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle>Bienvenue sur EDA Groupe</ModalTitle>
        </ModalHeader>
        <form ref={formRef} onSubmit={handleSubmit}>
          <ModalBody>
            <p className="text-sm text-muted-foreground">
              Voici le nom récupéré depuis votre compte Google. Confirmez-le ou modifiez-le avant de continuer.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Nom affiché</Label>
              <Input
                id="fullName"
                name="fullName"
                defaultValue={defaultName}
                autoFocus
                autoComplete="off"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Enregistrement…" : "Confirmer"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

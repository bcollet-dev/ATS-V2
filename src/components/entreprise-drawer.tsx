"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createEntreprise,
  createEntrepriseSchema,
  type CreateEntrepriseInput,
} from "@/app/(app)/annuaire/create-actions";

interface EntrepriseDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

export function EntrepriseDrawer({ open, onOpenChange, onCreated }: EntrepriseDrawerProps) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<CreateEntrepriseInput>({
    resolver: zodResolver(createEntrepriseSchema),
  });

  function onSubmit(data: CreateEntrepriseInput) {
    startTransition(async () => {
      const result = await createEntreprise(data);
      if (!result.success) {
        if (result.field === "siret") {
          setError("siret", { message: result.error });
        } else {
          toast.error(result.error);
        }
        return;
      }
      toast.success(`${result.data.name} créée`);
      reset();
      onOpenChange(false);
      onCreated?.(result.data.id);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Nouvelle entreprise</SheetTitle>
          <SheetClose />
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <SheetBody>
            <div className="space-y-1.5">
              <Label htmlFor="name">Raison sociale</Label>
              <Input id="name" {...register("name")} autoFocus />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="siret">SIRET</Label>
              <Input
                id="siret"
                {...register("siret")}
                placeholder="XXX XXX XXX XXXXX"
                maxLength={17}
              />
              {errors.siret && (
                <p className="text-xs text-destructive">{errors.siret.message}</p>
              )}
            </div>

            <div className="border-t pt-4 mt-2">
              <p className="text-sm font-medium text-foreground mb-3">Contact principal</p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="contactFirstName">Prénom</Label>
                    <Input id="contactFirstName" {...register("contactFirstName")} />
                    {errors.contactFirstName && (
                      <p className="text-xs text-destructive">{errors.contactFirstName.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contactLastName">Nom</Label>
                    <Input id="contactLastName" {...register("contactLastName")} />
                    {errors.contactLastName && (
                      <p className="text-xs text-destructive">{errors.contactLastName.message}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contactPhone">Téléphone</Label>
                  <Input id="contactPhone" type="tel" {...register("contactPhone")} />
                  {errors.contactPhone && (
                    <p className="text-xs text-destructive">{errors.contactPhone.message}</p>
                  )}
                </div>
              </div>
            </div>
          </SheetBody>
          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { reset(); onOpenChange(false); }}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Création…" : "Créer l'entreprise"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

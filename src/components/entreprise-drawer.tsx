"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Search, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
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
import { createEntreprise } from "@/app/(app)/annuaire/create-actions";
import { lookupSiret, type RegistryData } from "@/app/(app)/annuaire/siret-actions";
import {
  createEntrepriseSchema,
  type CreateEntrepriseInput,
} from "@/app/(app)/annuaire/schemas";

interface EntrepriseDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; closed: boolean; data: RegistryData }
  | { status: "not_found" }
  | { status: "error" };

export function EntrepriseDrawer({ open, onOpenChange, onCreated }: EntrepriseDrawerProps) {
  const [isPending, startTransition] = useTransition();
  const [isLooking, startLookup] = useTransition();
  const [lookup, setLookup] = useState<LookupState>({ status: "idle" });

  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<CreateEntrepriseInput>({
    resolver: zodResolver(createEntrepriseSchema),
    defaultValues: {
      name: "",
      siret: "",
      contactFirstName: "",
      contactLastName: "",
      contactPhone: "",
    },
  });

  function handleLookup() {
    const siret = getValues("siret")?.replace(/\s/g, "") ?? "";
    if (siret.length !== 14 || !/^\d{14}$/.test(siret)) {
      setError("siret", { message: "SIRET invalide (14 chiffres attendus)" });
      return;
    }
    setLookup({ status: "loading" });
    startLookup(async () => {
      const result = await lookupSiret(siret);
      if (!result.found) {
        setLookup({ status: "not_found" });
        return;
      }
      setLookup({ status: "found", closed: result.closed, data: result.data });
      setValue("name", result.data.name, { shouldValidate: true });
    });
  }

  function onSubmit(data: CreateEntrepriseInput) {
    const registryData = lookup.status === "found" ? lookup.data : null;
    startTransition(async () => {
      const result = await createEntreprise(data, registryData);
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
      setLookup({ status: "idle" });
      onOpenChange(false);
      onCreated?.(result.data.id);
    });
  }

  function handleClose() {
    reset();
    setLookup({ status: "idle" });
    onOpenChange(false);
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
            {/* SIRET + bouton recherche */}
            <div className="space-y-1.5">
              <Label htmlFor="siret">SIRET</Label>
              <div className="flex gap-2">
                <Controller
                  name="siret"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="siret"
                      placeholder="XXX XXX XXX XXXXX"
                      maxLength={17}
                      onChange={(e) => {
                        field.onChange(e);
                        setLookup({ status: "idle" });
                      }}
                      autoFocus
                    />
                  )}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleLookup}
                  disabled={isLooking}
                  title="Rechercher dans le registre"
                  className="shrink-0"
                >
                  {isLooking
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Search className="h-4 w-4" />
                  }
                </Button>
              </div>
              {errors.siret && (
                <p className="text-xs text-destructive">{errors.siret.message}</p>
              )}
              {lookup.status === "not_found" && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  SIRET introuvable dans le registre — saisie manuelle possible
                </p>
              )}
              {lookup.status === "found" && lookup.closed && (
                <p className="flex items-center gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Établissement fermé selon le registre
                </p>
              )}
              {lookup.status === "found" && !lookup.closed && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Établissement trouvé — raison sociale pré-remplie
                </p>
              )}
            </div>

            {/* Raison sociale */}
            <div className="space-y-1.5">
              <Label htmlFor="name">Raison sociale</Label>
              <Input id="name" {...register("name")} />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Contact principal */}
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
              onClick={handleClose}
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

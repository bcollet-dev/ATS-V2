"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { createCandidat, type SimilarCandidate } from "@/app/(app)/annuaire/create-actions";
import {
  createCandidatSchema,
  type CreateCandidatInput,
} from "@/app/(app)/annuaire/schemas";

interface CandidatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
  cursus: { id: string; name: string }[];
}

export function CandidatDrawer({ open, onOpenChange, onCreated, cursus }: CandidatDrawerProps) {
  const [isPending, startTransition] = useTransition();
  const [duplicates, setDuplicates] = useState<SimilarCandidate[] | null>(null);
  const [pendingData, setPendingData] = useState<CreateCandidatInput | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    formState: { errors },
  } = useForm<CreateCandidatInput>({
    resolver: zodResolver(createCandidatSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      cursusEnvisage: "",
    },
  });

  function doCreate(data: CreateCandidatInput, force: boolean) {
    startTransition(async () => {
      const result = await createCandidat(data, force);
      if (!result.success) {
        if (result.duplicates) {
          setDuplicates(result.duplicates);
          setPendingData(data);
          return;
        }
        if (result.field === "email") {
          setError("email", { message: result.error });
        } else {
          toast.error(result.error);
        }
        return;
      }
      toast.success(`${result.data.firstName} ${result.data.lastName} créé`);
      reset();
      setDuplicates(null);
      setPendingData(null);
      onOpenChange(false);
      onCreated?.(result.data.id);
    });
  }

  function onSubmit(data: CreateCandidatInput) {
    doCreate(data, false);
  }

  function handleForce() {
    if (pendingData) doCreate(pendingData, true);
  }

  function handleCancelDuplicate() {
    setDuplicates(null);
    setPendingData(null);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Nouveau candidat</SheetTitle>
          <SheetClose />
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <SheetBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">Prénom</Label>
                <Input id="firstName" {...register("firstName")} autoFocus />
                {errors.firstName && (
                  <p className="text-xs text-destructive">{errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Nom</Label>
                <Input id="lastName" {...register("lastName")} />
                {errors.lastName && (
                  <p className="text-xs text-destructive">{errors.lastName.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" type="tel" {...register("phone")} />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cursusEnvisage">Cursus envisagé</Label>
              <Controller
                name="cursusEnvisage"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    id="cursusEnvisage"
                    className={cn(
                      "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
                      "focus:outline-none focus:ring-1 focus:ring-ring",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      !field.value && "text-muted-foreground"
                    )}
                  >
                    <option value="">— Choisir un cursus —</option>
                    {cursus.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.cursusEnvisage && (
                <p className="text-xs text-destructive">{errors.cursusEnvisage.message}</p>
              )}
            </div>
          </SheetBody>

          {duplicates && (
            <div className="px-6 pb-4">
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
                <div className="flex items-center gap-2 text-amber-800 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Candidat(s) similaire(s) déjà enregistré(s)
                </div>
                <ul className="space-y-0.5 pl-6 text-sm text-amber-700">
                  {duplicates.map((d) => (
                    <li key={d.id}>
                      {d.firstName} {d.lastName.toUpperCase()}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-amber-600">
                  Vérifiez qu&apos;il ne s&apos;agit pas du même candidat avant de continuer.
                </p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={handleCancelDuplicate} disabled={isPending}>
                    Annuler
                  </Button>
                  <Button size="sm" onClick={handleForce} disabled={isPending}>
                    {isPending ? "Création…" : "Créer quand même"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <SheetFooter className={cn(duplicates && "hidden")}>
            <Button
              type="button"
              variant="outline"
              onClick={() => { reset(); onOpenChange(false); }}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Création…" : "Créer le candidat"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

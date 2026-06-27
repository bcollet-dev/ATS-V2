"use client";

import { useForm, Controller } from "react-hook-form";
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
import { cn } from "@/lib/utils";
import { createCandidat } from "@/app/(app)/annuaire/create-actions";
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

  function onSubmit(data: CreateCandidatInput) {
    startTransition(async () => {
      const result = await createCandidat(data);
      if (!result.success) {
        if (result.field === "email") {
          setError("email", { message: result.error });
        } else {
          toast.error(result.error);
        }
        return;
      }
      toast.success(`${result.data.firstName} ${result.data.lastName} créé`);
      reset();
      onOpenChange(false);
      onCreated?.(result.data.id);
    });
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
            <div className="grid grid-cols-2 gap-4">
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
              {isPending ? "Création…" : "Créer le candidat"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

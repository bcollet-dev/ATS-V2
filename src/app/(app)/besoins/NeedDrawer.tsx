"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose, SheetBody, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createNeed } from "./actions";

const schema = z.object({
  companyId: z.string().min(1, "Entreprise requise"),
  title: z.string().min(1, "Titre requis"),
  targetCursusId: z.string().optional(),
  city: z.string().optional(),
  positionsCount: z.coerce.number().int().min(1),
  ownerId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function NeedDrawer({
  open,
  onOpenChange,
  companies,
  cursus,
  profiles,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: { id: string; name: string }[];
  cursus: { id: string; name: string }[];
  profiles: { id: string; fullName: string }[];
  onCreated?: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyId: "",
      title: "",
      targetCursusId: "",
      city: "",
      positionsCount: 1,
      ownerId: "",
    },
  });

  function onSubmit(data: FormData) {
    startTransition(async () => {
      const result = await createNeed(data);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Besoin « ${result.data.title} » créé`);
      reset();
      onOpenChange(false);
      onCreated?.(result.data.id);
    });
  }

  const selectClass = cn(
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
    "focus:outline-none focus:ring-1 focus:ring-ring",
    "disabled:cursor-not-allowed disabled:opacity-50"
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Nouveau besoin</SheetTitle>
          <SheetClose />
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <SheetBody>
            {/* Entreprise */}
            <div className="space-y-1.5">
              <Label htmlFor="companyId">Entreprise <span className="text-destructive">*</span></Label>
              <Controller
                name="companyId"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    id="companyId"
                    autoFocus
                    className={cn(selectClass, !field.value && "text-muted-foreground")}
                  >
                    <option value="">— Choisir une entreprise —</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              />
              {errors.companyId && <p className="text-xs text-destructive">{errors.companyId.message}</p>}
            </div>

            {/* Titre */}
            <div className="space-y-1.5">
              <Label htmlFor="title">Titre du poste <span className="text-destructive">*</span></Label>
              <Input id="title" {...register("title")} placeholder="Ex : Chargé de communication" />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Ville */}
              <div className="space-y-1.5">
                <Label htmlFor="city">Ville</Label>
                <Input id="city" {...register("city")} placeholder="Ex : Paris" />
              </div>

              {/* Postes */}
              <div className="space-y-1.5">
                <Label htmlFor="positionsCount">Nb de postes</Label>
                <Input
                  id="positionsCount"
                  type="number"
                  min={1}
                  {...register("positionsCount", { valueAsNumber: true })}
                />
              </div>
            </div>

            {/* Cursus */}
            <div className="space-y-1.5">
              <Label htmlFor="targetCursusId">Cursus visé</Label>
              <Controller
                name="targetCursusId"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    id="targetCursusId"
                    className={cn(selectClass, !field.value && "text-muted-foreground")}
                  >
                    <option value="">— Non renseigné —</option>
                    {cursus.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              />
            </div>

            {/* Recruteur */}
            <div className="space-y-1.5">
              <Label htmlFor="ownerId">Recruteur assigné</Label>
              <Controller
                name="ownerId"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    id="ownerId"
                    className={cn(selectClass, !field.value && "text-muted-foreground")}
                  >
                    <option value="">— Non assigné —</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>{p.fullName}</option>
                    ))}
                  </select>
                )}
              />
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
              {isPending ? "Création…" : "Créer le besoin"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect, useTransition, useRef } from "react";
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

const TASK_CATEGORIES = [
  { value: "call",              label: "Appel" },
  { value: "email",             label: "Email" },
  { value: "follow_up",         label: "Relance" },
  { value: "interview",         label: "Entretien" },
  { value: "video_interview",   label: "Entretien vidéo" },
  { value: "onsite_interview",  label: "Entretien présentiel" },
  { value: "document",          label: "Document" },
  { value: "administrative",    label: "Administratif" },
  { value: "other",             label: "Autre" },
] as const;

const schema = z.object({
  companyId: z.string().min(1, "Entreprise requise"),
  title: z.string().min(1, "Titre requis"),
  targetCursusId: z.string().optional(),
  city: z.string().optional(),
  positionsCount: z.coerce.number().int().min(1),
  ownerId: z.string().optional(),
  task: z.object({
    category: z.enum(["call", "email", "document", "follow_up", "interview", "other", "video_interview", "onsite_interview", "administrative"]),
    title: z.string().min(1, "Titre de la tâche requis"),
    assignedTo: z.string().min(1, "Responsable requis"),
    dueAt: z.string().optional(),
    notes: z.string().optional(),
  }),
});

type FormData = z.infer<typeof schema>;

export function NeedDrawer({
  open,
  onOpenChange,
  companies,
  cursus,
  profiles,
  defaultCompanyId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: { id: string; name: string }[];
  cursus: { id: string; name: string }[];
  profiles: { id: string; fullName: string }[];
  defaultCompanyId?: string;
  onCreated?: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  // Tracks whether user has manually changed the task owner (breaks auto-sync with besoin owner)
  const taskOwnerManuallySet = useRef(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyId: defaultCompanyId ?? "",
      title: "",
      targetCursusId: "",
      city: "",
      positionsCount: 1,
      ownerId: "",
      task: {
        category: "call",
        title: "Premier contact",
        assignedTo: "",
        dueAt: "",
        notes: "",
      },
    },
  });

  const ownerIdValue = watch("ownerId");

  // Sync task owner with besoin owner unless manually overridden
  useEffect(() => {
    if (!taskOwnerManuallySet.current) {
      setValue("task.assignedTo", ownerIdValue ?? "");
    }
  }, [ownerIdValue, setValue]);

  function handleClose() {
    reset();
    taskOwnerManuallySet.current = false;
    onOpenChange(false);
  }

  function onSubmit(data: FormData) {
    startTransition(async () => {
      const result = await createNeed(data);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Besoin « ${result.data.title} » créé avec tâche de premier contact`);
      reset();
      taskOwnerManuallySet.current = false;
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
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Nouveau besoin</SheetTitle>
          <SheetClose />
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <SheetBody className="space-y-4">
            {/* ── Besoin ─────────────────────────────────────────── */}

            {/* Entreprise */}
            <div className="space-y-1.5">
              <Label htmlFor="companyId">Entreprise <span className="text-destructive">*</span></Label>
              <Controller
                name="companyId"
                control={control}
                render={({ field }) =>
                  defaultCompanyId ? (
                    <div className="flex h-9 items-center px-3 rounded-md border border-input bg-muted/40 text-sm">
                      {companies.find((c) => c.id === defaultCompanyId)?.name ?? defaultCompanyId}
                    </div>
                  ) : (
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
                  )
                }
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
              <div className="space-y-1.5">
                <Label htmlFor="city">Ville</Label>
                <Input id="city" {...register("city")} placeholder="Ex : Paris" />
              </div>
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

            {/* ── Tâche de premier contact ────────────────────────── */}
            <div className="pt-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Tâche de premier contact
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-4">
                {/* Catégorie + Titre côte à côte */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="task.category">Catégorie</Label>
                    <Controller
                      name="task.category"
                      control={control}
                      render={({ field }) => (
                        <select {...field} id="task.category" className={selectClass}>
                          {TASK_CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      )}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="task.title">Titre <span className="text-destructive">*</span></Label>
                    <Input
                      id="task.title"
                      {...register("task.title")}
                      placeholder="Premier contact"
                    />
                    {errors.task?.title && <p className="text-xs text-destructive">{errors.task.title.message}</p>}
                  </div>
                </div>

                {/* Responsable */}
                <div className="space-y-1.5">
                  <Label htmlFor="task.assignedTo">
                    Responsable <span className="text-destructive">*</span>
                  </Label>
                  <Controller
                    name="task.assignedTo"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        id="task.assignedTo"
                        className={cn(selectClass, !field.value && "text-muted-foreground")}
                        onChange={(e) => {
                          field.onChange(e);
                          taskOwnerManuallySet.current = true;
                        }}
                      >
                        <option value="">— Choisir un responsable —</option>
                        {profiles.map((p) => (
                          <option key={p.id} value={p.id}>{p.fullName}</option>
                        ))}
                      </select>
                    )}
                  />
                  {errors.task?.assignedTo && (
                    <p className="text-xs text-destructive">{errors.task.assignedTo.message}</p>
                  )}
                </div>

                {/* Deadline */}
                <div className="space-y-1.5">
                  <Label htmlFor="task.dueAt">Deadline</Label>
                  <Input
                    id="task.dueAt"
                    type="date"
                    {...register("task.dueAt")}
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label htmlFor="task.notes">Notes</Label>
                  <textarea
                    id="task.notes"
                    {...register("task.notes")}
                    placeholder="Notes optionnelles…"
                    className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                  />
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
              {isPending ? "Création…" : "Créer le besoin"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

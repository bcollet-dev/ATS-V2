"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Briefcase, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalClose, ModalBody, ModalFooter } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import {
  addExperience,
  updateExperience,
  deleteExperience,
  type ExperienceInput,
  type ExperienceRow,
} from "./experience-actions";

const CONTRACT_OPTIONS = ["CDI", "CDD", "Stage", "Alternance", "Freelance", "Autre"];

const SELECT_CLASS = cn(
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
  "focus:outline-none focus:ring-1 focus:ring-ring"
);

const MONTHS_FR = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

function formatMonth(yyyyMM: string): string {
  if (!yyyyMM || !yyyyMM.includes("-")) return "—";
  const [year, month] = yyyyMM.split("-");
  const idx = parseInt(month, 10) - 1;
  if (idx < 0 || idx > 11) return year || "—";
  return `${MONTHS_FR[idx]} ${year}`;
}

const EMPTY: ExperienceInput = {
  jobTitle: "", company: "", contractType: "",
  startMonth: "", endMonth: "", isCurrent: false, description: "",
};

type DialogState =
  | { open: false }
  | { open: true; mode: "add" }
  | { open: true; mode: "edit"; exp: ExperienceRow };

export function BlocExperiences({
  candidateId,
  initialExperiences,
  embedded,
}: {
  candidateId: string;
  initialExperiences: ExperienceRow[];
  embedded?: boolean;
}) {
  const [experiences, setExperiences] = useState<ExperienceRow[]>(initialExperiences);
  const [dialog, setDialog] = useState<DialogState>({ open: false });
  const [isSaving, startSave] = useTransition();

  const { register, handleSubmit, control, watch, reset, setValue } =
    useForm<ExperienceInput>({ defaultValues: EMPTY });

  const isCurrent = watch("isCurrent");

  function openAdd() { reset(EMPTY); setDialog({ open: true, mode: "add" }); }
  function openEdit(exp: ExperienceRow) {
    reset({
      jobTitle: exp.jobTitle, company: exp.company, contractType: exp.contractType ?? "",
      startMonth: exp.startMonth, endMonth: exp.endMonth ?? "",
      isCurrent: exp.isCurrent, description: exp.description ?? "",
    });
    setDialog({ open: true, mode: "edit", exp });
  }
  function close() { setDialog({ open: false }); }

  function sorted(list: ExperienceRow[]) {
    return [...list].sort((a, b) => b.startMonth.localeCompare(a.startMonth));
  }

  function onSubmit(values: ExperienceInput) {
    startSave(async () => {
      if (dialog.open && dialog.mode === "add") {
        const res = await addExperience(candidateId, values);
        if (!res.success || !res.data) { toast.error(res.error); return; }
        setExperiences((prev) => sorted([...prev, res.data!]));
        toast.success("Expérience ajoutée");
      } else if (dialog.open && dialog.mode === "edit") {
        const res = await updateExperience(dialog.exp.id, candidateId, values);
        if (!res.success || !res.data) { toast.error(res.error); return; }
        setExperiences((prev) => sorted(prev.map((e) => (e.id === dialog.exp.id ? res.data! : e))));
        toast.success("Expérience mise à jour");
      }
      close();
    });
  }

  function handleDelete(exp: ExperienceRow) {
    setExperiences((prev) => prev.filter((e) => e.id !== exp.id));
    let cancelled = false;
    const timerId = setTimeout(async () => {
      if (!cancelled) await deleteExperience(exp.id, candidateId);
    }, 4000);
    toast("Expérience supprimée", {
      action: { label: "Annuler", onClick: () => { cancelled = true; clearTimeout(timerId); setExperiences((prev) => sorted([...prev, exp])); } },
      duration: 4000,
    });
  }

  const header = (
    <div className={cn(
      "flex items-center justify-between px-5",
      embedded ? "py-3" : "py-3.5 border-b"
    )}>
      {embedded
        ? <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Expériences professionnelles</span>
        : <h2 className="text-sm font-semibold">Expériences professionnelles</h2>
      }
      <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={openAdd}>
        <Plus className="h-3.5 w-3.5" />
        Ajouter
      </Button>
    </div>
  );

  const list = (
    <div className="divide-y">
      {experiences.length === 0 ? (
        <p className="px-5 py-6 text-sm text-center text-muted-foreground italic">
          Aucune expérience renseignée
        </p>
      ) : (
        experiences.map((exp) => (
          <div key={exp.id} className="px-5 py-3.5 flex gap-3 group">
            <div className="mt-0.5 rounded-full bg-muted p-1.5 shrink-0 h-fit">
              <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium leading-tight">{exp.jobTitle}</p>
                  <p className="text-sm text-muted-foreground">
                    {exp.company}
                    {exp.contractType && <span className="text-muted-foreground/60"> · {exp.contractType}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatMonth(exp.startMonth)}
                    {" → "}
                    {exp.isCurrent
                      ? <span className="text-emerald-600 font-medium">En poste</span>
                      : exp.endMonth ? formatMonth(exp.endMonth) : "—"
                    }
                  </p>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => openEdit(exp)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(exp)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {exp.description && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{exp.description}</p>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );

  const modal = (
    <Modal open={dialog.open} onOpenChange={(open) => { if (!open) close(); }}>
      <ModalContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalHeader>
            <ModalTitle>
              {dialog.open && dialog.mode === "edit" ? "Modifier l'expérience" : "Ajouter une expérience"}
            </ModalTitle>
            <ModalClose />
          </ModalHeader>
          <ModalBody>
            <div className="space-y-1.5">
              <Label htmlFor="xp-jobTitle">Intitulé du poste *</Label>
              <Input id="xp-jobTitle" {...register("jobTitle", { required: true })} placeholder="Ex : Développeur web" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="xp-company">Entreprise *</Label>
                <Input id="xp-company" {...register("company", { required: true })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="xp-contract">Type de contrat</Label>
                <Controller name="contractType" control={control} render={({ field }) => (
                  <select {...field} id="xp-contract" className={SELECT_CLASS}>
                    <option value="">— Non précisé</option>
                    {CONTRACT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                )} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="xp-start">Début *</Label>
                <Input id="xp-start" type="month" {...register("startMonth", { required: true })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="xp-end">Fin</Label>
                <Input id="xp-end" type="month" {...register("endMonth")} disabled={isCurrent} className={isCurrent ? "opacity-40" : ""} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Controller name="isCurrent" control={control} render={({ field }) => (
                <input type="checkbox" id="xp-current" checked={field.value}
                  onChange={(e) => { field.onChange(e.target.checked); if (e.target.checked) setValue("endMonth", ""); }}
                  className="h-4 w-4 rounded border-input" />
              )} />
              <Label htmlFor="xp-current" className="font-normal cursor-pointer">En poste actuellement</Label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="xp-desc">Description <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
              <Controller name="description" control={control} render={({ field }) => (
                <Textarea id="xp-desc" {...field} rows={3} placeholder="Missions, réalisations…" />
              )} />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" size="sm" onClick={close} disabled={isSaving}>Annuler</Button>
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Enregistrement…</> : "Enregistrer"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );

  if (embedded) {
    return (
      <>
        <div>{header}{list}</div>
        {modal}
      </>
    );
  }

  return (
    <>
      <section className="rounded-lg border bg-card">{header}{list}</section>
      {modal}
    </>
  );
}

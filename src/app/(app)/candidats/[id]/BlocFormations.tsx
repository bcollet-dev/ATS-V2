"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalClose, ModalBody, ModalFooter } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import {
  addFormation,
  updateFormation,
  deleteFormation,
  type FormationInput,
  type FormationRow,
} from "./formation-actions";

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

const EMPTY: FormationInput = {
  title: "", institution: "", startMonth: "", endMonth: "", isCurrent: false,
};

type DialogState =
  | { open: false }
  | { open: true; mode: "add" }
  | { open: true; mode: "edit"; formation: FormationRow };

export function BlocFormations({
  candidateId,
  initialFormations,
  embedded,
}: {
  candidateId: string;
  initialFormations: FormationRow[];
  embedded?: boolean;
}) {
  const [formations, setFormations] = useState<FormationRow[]>(initialFormations);
  const [dialog, setDialog] = useState<DialogState>({ open: false });
  const [isSaving, startSave] = useTransition();

  const { register, handleSubmit, control, watch, reset, setValue } =
    useForm<FormationInput>({ defaultValues: EMPTY });

  const isCurrent = watch("isCurrent");

  function openAdd() { reset(EMPTY); setDialog({ open: true, mode: "add" }); }
  function openEdit(formation: FormationRow) {
    reset({
      title: formation.title, institution: formation.institution,
      startMonth: formation.startMonth, endMonth: formation.endMonth ?? "",
      isCurrent: formation.isCurrent,
    });
    setDialog({ open: true, mode: "edit", formation });
  }
  function close() { setDialog({ open: false }); }

  function sorted(list: FormationRow[]) {
    return [...list].sort((a, b) => b.startMonth.localeCompare(a.startMonth));
  }

  function onSubmit(values: FormationInput) {
    startSave(async () => {
      if (dialog.open && dialog.mode === "add") {
        const res = await addFormation(candidateId, values);
        if (!res.success || !res.data) { toast.error(res.error); return; }
        setFormations((prev) => sorted([...prev, res.data!]));
        toast.success("Formation ajoutée");
      } else if (dialog.open && dialog.mode === "edit") {
        const res = await updateFormation(dialog.formation.id, candidateId, values);
        if (!res.success || !res.data) { toast.error(res.error); return; }
        setFormations((prev) => sorted(prev.map((f) => (f.id === dialog.formation.id ? res.data! : f))));
        toast.success("Formation mise à jour");
      }
      close();
    });
  }

  function handleDelete(formation: FormationRow) {
    setFormations((prev) => prev.filter((f) => f.id !== formation.id));
    let cancelled = false;
    const timerId = setTimeout(async () => {
      if (!cancelled) await deleteFormation(formation.id, candidateId);
    }, 4000);
    toast("Formation supprimée", {
      action: { label: "Annuler", onClick: () => { cancelled = true; clearTimeout(timerId); setFormations((prev) => sorted([...prev, formation])); } },
      duration: 4000,
    });
  }

  const header = (
    <div className={cn(
      "flex items-center justify-between px-5",
      embedded ? "py-3" : "py-3.5 border-b"
    )}>
      {embedded
        ? <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Formations</span>
        : <h2 className="text-sm font-semibold">Formations</h2>
      }
      <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={openAdd}>
        <Plus className="h-3.5 w-3.5" />
        Ajouter
      </Button>
    </div>
  );

  const list = (
    <div className="divide-y">
      {formations.length === 0 ? (
        <p className="px-5 py-6 text-sm text-center text-muted-foreground italic">
          Aucune formation renseignée
        </p>
      ) : (
        formations.map((formation) => (
          <div key={formation.id} className="px-5 py-3.5 flex gap-3 group">
            <div className="mt-0.5 rounded-full bg-muted p-1.5 shrink-0 h-fit">
              <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium leading-tight">{formation.title}</p>
                  <p className="text-sm text-muted-foreground">{formation.institution}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatMonth(formation.startMonth)}
                    {" → "}
                    {formation.isCurrent
                      ? <span className="text-blue-600 font-medium">En cours</span>
                      : formation.endMonth ? formatMonth(formation.endMonth) : "—"
                    }
                  </p>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => openEdit(formation)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(formation)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
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
              {dialog.open && dialog.mode === "edit" ? "Modifier la formation" : "Ajouter une formation"}
            </ModalTitle>
            <ModalClose />
          </ModalHeader>
          <ModalBody>
            <div className="space-y-1.5">
              <Label htmlFor="fo-title">Intitulé / diplôme *</Label>
              <Input id="fo-title" {...register("title", { required: true })} placeholder="Ex : BTS SIO, Licence pro…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fo-inst">Établissement *</Label>
              <Input id="fo-inst" {...register("institution", { required: true })} placeholder="Ex : Lycée Victor Hugo" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fo-start">Début *</Label>
                <Input id="fo-start" type="month" {...register("startMonth", { required: true })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fo-end">Fin</Label>
                <Input id="fo-end" type="month" {...register("endMonth")} disabled={isCurrent} className={isCurrent ? "opacity-40" : ""} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Controller name="isCurrent" control={control} render={({ field }) => (
                <input type="checkbox" id="fo-current" checked={field.value}
                  onChange={(e) => { field.onChange(e.target.checked); if (e.target.checked) setValue("endMonth", ""); }}
                  className="h-4 w-4 rounded border-input" />
              )} />
              <Label htmlFor="fo-current" className="font-normal cursor-pointer">En cours actuellement</Label>
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

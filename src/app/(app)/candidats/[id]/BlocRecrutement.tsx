"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { updateRecrutement, type UpdateRecrutementInput } from "./actions";

const SOURCE_OPTIONS = [
  { value: "", label: "— Non renseigné" },
  { value: "Site web", label: "Site web" },
  { value: "Recommandation", label: "Recommandation" },
  { value: "LinkedIn", label: "LinkedIn" },
  { value: "Indeed", label: "Indeed" },
  { value: "France Travail", label: "France Travail" },
  { value: "Salon / Événement", label: "Salon / Événement" },
  { value: "Ypareo", label: "Ypareo" },
  { value: "Autre", label: "Autre" },
];

const SELECT_CLASS = cn(
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
  "focus:outline-none focus:ring-1 focus:ring-ring"
);

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || <span className="text-muted-foreground/60 italic">—</span>}</dd>
    </div>
  );
}

export function BlocRecrutement({
  candidateId,
  data,
  cursus,
}: {
  candidateId: string;
  data: { cursusEnvisage: string | null; source: string | null };
  cursus: { id: string; name: string }[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, startSave] = useTransition();

  const { handleSubmit, control, reset } = useForm<UpdateRecrutementInput>({
    defaultValues: {
      cursusEnvisage: data.cursusEnvisage ?? "",
      source: data.source ?? "",
    },
  });

  function onSubmit(values: UpdateRecrutementInput) {
    startSave(async () => {
      const result = await updateRecrutement(candidateId, values);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Recrutement mis à jour");
      setIsEditing(false);
    });
  }

  function handleCancel() {
    reset();
    setIsEditing(false);
  }

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center justify-between px-5 py-3.5 border-b">
        <h2 className="text-sm font-semibold">Recrutement</h2>
        {!isEditing && (
          <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setIsEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Modifier
          </Button>
        )}
      </div>

      {!isEditing ? (
        <dl className="px-5 py-4 grid grid-cols-2 gap-x-8 gap-y-4">
          <Field label="Cursus envisagé" value={data.cursusEnvisage} />
          <Field label="Source" value={data.source} />
        </dl>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="re-cursus">Cursus envisagé</Label>
              <Controller
                name="cursusEnvisage"
                control={control}
                render={({ field }) => (
                  <select {...field} id="re-cursus" className={SELECT_CLASS}>
                    <option value="">— Choisir un cursus —</option>
                    {cursus.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="re-source">Source</Label>
              <Controller
                name="source"
                control={control}
                render={({ field }) => (
                  <select {...field} id="re-source" className={SELECT_CLASS}>
                    {SOURCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                )}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Enregistrement…</>
                : "Enregistrer"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

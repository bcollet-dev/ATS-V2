"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { updateRepresentantLegal, type UpdateRepresentantLegalInput } from "./actions";

const LIEN_OPTIONS = [
  { value: "", label: "— Non renseigné" },
  { value: "Père", label: "Père" },
  { value: "Mère", label: "Mère" },
  { value: "Tuteur légal", label: "Tuteur légal" },
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

type RepresentantLegalData = {
  legalRepFirstName: string | null;
  legalRepLastName: string | null;
  legalRepLink: string | null;
  legalRepPhone: string | null;
  legalRepEmail: string | null;
};

export function BlocRepresentantLegal({
  candidateId,
  data,
}: {
  candidateId: string;
  data: RepresentantLegalData;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, startSave] = useTransition();

  const { register, handleSubmit, control, reset } = useForm<UpdateRepresentantLegalInput>({
    defaultValues: {
      legalRepFirstName: data.legalRepFirstName ?? "",
      legalRepLastName: data.legalRepLastName ?? "",
      legalRepLink: data.legalRepLink ?? "",
      legalRepPhone: data.legalRepPhone ?? "",
      legalRepEmail: data.legalRepEmail ?? "",
    },
  });

  function onSubmit(values: UpdateRepresentantLegalInput) {
    startSave(async () => {
      const result = await updateRepresentantLegal(candidateId, values);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Représentant légal mis à jour");
      setIsEditing(false);
    });
  }

  function handleCancel() {
    reset();
    setIsEditing(false);
  }

  const isEmpty = !data.legalRepFirstName && !data.legalRepLastName && !data.legalRepLink
    && !data.legalRepPhone && !data.legalRepEmail;

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center justify-between px-5 py-3.5 border-b">
        <div>
          <h2 className="text-sm font-semibold">Représentant légal</h2>
          {isEmpty && !isEditing && (
            <p className="text-xs text-muted-foreground mt-0.5">Si mineur — non renseigné</p>
          )}
        </div>
        {!isEditing && (
          <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setIsEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Modifier
          </Button>
        )}
      </div>

      {!isEditing ? (
        <dl className="px-5 py-4 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
          <Field label="Prénom" value={data.legalRepFirstName} />
          <Field label="Nom" value={data.legalRepLastName} />
          <Field label="Lien" value={data.legalRepLink} />
          <Field label="Téléphone" value={data.legalRepPhone} />
          <Field label="Email" value={data.legalRepEmail} />
        </dl>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="legalRepFirstName">Prénom</Label>
              <Input id="legalRepFirstName" {...register("legalRepFirstName")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="legalRepLastName">Nom</Label>
              <Input id="legalRepLastName" {...register("legalRepLastName")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="legalRepLink">Lien</Label>
              <Controller
                name="legalRepLink"
                control={control}
                render={({ field }) => (
                  <select {...field} id="legalRepLink" className={SELECT_CLASS}>
                    {LIEN_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="legalRepPhone">Téléphone</Label>
              <Input id="legalRepPhone" type="tel" {...register("legalRepPhone")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="legalRepEmail">Email</Label>
              <Input id="legalRepEmail" type="email" {...register("legalRepEmail")} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Enregistrement…</> : "Enregistrer"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

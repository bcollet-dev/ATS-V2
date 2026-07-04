"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateContact, type UpdateContactInput } from "./actions";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value || <span className="text-muted-foreground/60 italic font-normal">—</span>}</dd>
    </div>
  );
}

export function BlocContact({
  candidateId,
  data,
  canEdit = true,
}: {
  candidateId: string;
  data: { email: string | null; phone: string | null };
  canEdit?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, startSave] = useTransition();

  const { register, handleSubmit, reset } = useForm<UpdateContactInput>({
    defaultValues: {
      email: data.email ?? "",
      phone: data.phone ?? "",
    },
  });

  function onSubmit(values: UpdateContactInput) {
    startSave(async () => {
      const result = await updateContact(candidateId, values);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Contact mis à jour");
      setIsEditing(false);
    });
  }

  function handleCancel() {
    reset();
    setIsEditing(false);
  }

  return (
    <section className="rounded-lg border-2 border-primary/25 bg-card overflow-hidden shadow-sm">
      <div className="h-1 bg-primary/70" />
      <div className="flex items-center justify-between px-5 py-3.5 border-b bg-primary/[0.03]">
        <h2 className="text-sm font-semibold">Contact</h2>
        {!isEditing && canEdit && (
          <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setIsEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Modifier
          </Button>
        )}
      </div>

      {!isEditing ? (
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
          <Field label="Email" value={data.email} />
          <Field label="Téléphone" value={data.phone} />
        </dl>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ct-email">Email</Label>
              <Input id="ct-email" type="email" {...register("email")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-phone">Téléphone</Label>
              <Input id="ct-phone" type="tel" {...register("phone")} />
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

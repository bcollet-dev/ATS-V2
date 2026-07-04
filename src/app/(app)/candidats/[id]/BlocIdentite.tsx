"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { Pencil, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CommuneInput } from "./CommuneInput";
import { PaysInput } from "./PaysInput";
import { updateIdentite, revealNir, type UpdateIdentiteInput } from "./actions";

const SELECT_CLASS = cn(
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
  "focus:outline-none focus:ring-1 focus:ring-ring"
);

const LIEN_OPTIONS = [
  { value: "", label: "— Non renseigné" },
  { value: "Père", label: "Père" },
  { value: "Mère", label: "Mère" },
  { value: "Tuteur légal", label: "Tuteur légal" },
  { value: "Autre", label: "Autre" },
];

type IdentiteData = {
  title: string | null;
  firstName: string;
  lastName: string;
  birthName: string | null;
  birthDate: string | null;
  birthCity: string | null;
  birthDepartment: string | null;
  birthCountry: string | null;
  nationality: string | null;
  rqth: boolean;
  hasNir: boolean;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  legalRepFirstName: string | null;
  legalRepLastName: string | null;
  legalRepLink: string | null;
  legalRepPhone: string | null;
  legalRepEmail: string | null;
};

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || <span className="text-muted-foreground/60 italic">—</span>}</dd>
    </div>
  );
}

export function BlocIdentite({
  candidateId,
  data,
  canRevealNir,
  canEdit = true,
}: {
  candidateId: string;
  data: IdentiteData;
  canRevealNir: boolean;
  canEdit?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [nirVisible, setNirVisible] = useState<string | null>(null);
  const [isRevealing, startReveal] = useTransition();
  const [isSaving, startSave] = useTransition();

  const { register, handleSubmit, control, setValue, watch, reset } =
    useForm<UpdateIdentiteInput>({
      defaultValues: {
        title: data.title ?? "",
        firstName: data.firstName,
        lastName: data.lastName,
        birthName: data.birthName ?? "",
        birthDate: data.birthDate ?? "",
        birthCity: data.birthCity ?? "",
        birthDepartment: data.birthDepartment ?? "",
        birthCountry: data.birthCountry ?? "",
        nationality: data.nationality ?? "",
        rqth: data.rqth,
        nir: "",
        addressLine1: data.addressLine1 ?? "",
        addressLine2: data.addressLine2 ?? "",
        postalCode: data.postalCode ?? "",
        city: data.city ?? "",
        legalRepFirstName: data.legalRepFirstName ?? "",
        legalRepLastName: data.legalRepLastName ?? "",
        legalRepLink: data.legalRepLink ?? "",
        legalRepPhone: data.legalRepPhone ?? "",
        legalRepEmail: data.legalRepEmail ?? "",
      },
    });

  const birthDepartment = watch("birthDepartment");

  const hasLegalRep = !!(data.legalRepFirstName || data.legalRepLastName || data.legalRepPhone || data.legalRepEmail);

  const address = [
    data.addressLine1,
    data.addressLine2,
    [data.postalCode, data.city].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");

  function handleReveal() {
    if (nirVisible) { setNirVisible(null); return; }
    startReveal(async () => {
      const result = await revealNir(candidateId);
      if ("error" in result) { toast.error(result.error); return; }
      setNirVisible(result.nir);
      setTimeout(() => setNirVisible(null), 30_000);
    });
  }

  function onSubmit(values: UpdateIdentiteInput) {
    startSave(async () => {
      const result = await updateIdentite(candidateId, values);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Identité mise à jour");
      setIsEditing(false);
    });
  }

  function handleCancel() {
    reset();
    setIsEditing(false);
  }

  const displayBirthPlace = [
    data.birthCity,
    data.birthDepartment ? `(${data.birthDepartment})` : null,
  ].filter(Boolean).join(" ");

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center justify-between px-5 py-3.5 border-b">
        <h2 className="text-sm font-semibold">Identité</h2>
        {!isEditing && canEdit && (
          <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setIsEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Modifier
          </Button>
        )}
      </div>

      {!isEditing ? (
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-3">
          <Field label="Civilité" value={data.title} />
          <Field label="Prénom" value={data.firstName} />
          <Field label="Nom d'usage" value={data.lastName} />
          <Field label="Nom de naissance" value={data.birthName} />
          <Field label="Date de naissance" value={data.birthDate ?? undefined} />
          <Field label="Commune de naissance" value={displayBirthPlace || null} />
          <Field label="Pays de naissance" value={data.birthCountry} />
          <Field label="Nationalité" value={data.nationality} />
          <Field label="RQTH" value={data.rqth ? "Oui" : "Non"} />
          {/* NIR */}
          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">NIR</dt>
            <dd className="flex items-center gap-2 text-sm">
              {nirVisible
                ? <span className="font-mono">{nirVisible}</span>
                : <span className="tracking-widest text-muted-foreground">●●●●●●●●●●●●●</span>
              }
              {canRevealNir && (
                <button
                  onClick={handleReveal}
                  disabled={isRevealing}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title={nirVisible ? "Masquer" : "Révéler"}
                >
                  {isRevealing
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : nirVisible
                      ? <EyeOff className="h-3.5 w-3.5" />
                      : <Eye className="h-3.5 w-3.5" />
                  }
                </button>
              )}
              {!data.hasNir && <span className="text-xs text-muted-foreground/60 italic">non renseigné</span>}
            </dd>
          </div>

          {/* Adresse */}
          <div className="col-span-2 sm:col-span-3 border-t pt-3 pb-0">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Adresse</span>
          </div>
          <div className="col-span-2 sm:col-span-3 space-y-0.5">
            <dd className="text-sm">{address || <span className="text-muted-foreground/60 italic">—</span>}</dd>
          </div>

          {/* Représentant légal */}
          <div className="col-span-2 sm:col-span-3 border-t pt-3 pb-0">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Représentant légal {!hasLegalRep && <span className="font-normal normal-case tracking-normal">(si mineur) — non renseigné</span>}
            </span>
          </div>
          {hasLegalRep && (
            <>
              <Field label="Prénom" value={data.legalRepFirstName} />
              <Field label="Nom" value={data.legalRepLastName} />
              <Field label="Lien" value={data.legalRepLink} />
              <Field label="Téléphone" value={data.legalRepPhone} />
              <Field label="Email" value={data.legalRepEmail} />
            </>
          )}
        </dl>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
          {/* État civil */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="title">Civilité</Label>
              <Controller
                name="title"
                control={control}
                render={({ field }) => (
                  <select {...field} id="title" className={SELECT_CLASS}>
                    <option value="">—</option>
                    <option value="M.">M.</option>
                    <option value="Mme">Mme</option>
                  </select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="firstName">Prénom</Label>
              <Input id="firstName" {...register("firstName")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Nom d'usage</Label>
              <Input id="lastName" {...register("lastName")} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="birthName">Nom de naissance</Label>
              <Input id="birthName" {...register("birthName")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="birthDate">Date de naissance</Label>
              <Input id="birthDate" type="date" {...register("birthDate")} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Commune de naissance</Label>
              <Controller
                name="birthCity"
                control={control}
                render={({ field }) => (
                  <CommuneInput
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onSelectCommune={(nom, dep) => {
                      setValue("birthCity", nom);
                      setValue("birthDepartment", dep);
                    }}
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="birthDepartment">Département</Label>
              <Input
                id="birthDepartment"
                value={birthDepartment ?? ""}
                readOnly
                className="bg-muted/50 text-muted-foreground"
                placeholder="Auto"
                tabIndex={-1}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Pays de naissance</Label>
              <Controller
                name="birthCountry"
                control={control}
                render={({ field }) => (
                  <PaysInput
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nationality">Nationalité</Label>
              <Input id="nationality" {...register("nationality")} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Controller
              name="rqth"
              control={control}
              render={({ field }) => (
                <input
                  type="checkbox"
                  id="rqth"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
              )}
            />
            <Label htmlFor="rqth" className="font-normal cursor-pointer">RQTH</Label>
          </div>

          {canRevealNir && (
            <div className="space-y-1.5">
              <Label htmlFor="nir">NIR <span className="text-xs text-muted-foreground font-normal">(laisser vide pour ne pas modifier)</span></Label>
              <Input id="nir" {...register("nir")} placeholder="15 chiffres" autoComplete="off" />
            </div>
          )}

          {/* Adresse */}
          <div className="border-t pt-4 space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Adresse</p>
            <div className="space-y-1.5">
              <Label htmlFor="addressLine1">Rue</Label>
              <Input id="addressLine1" {...register("addressLine1")} placeholder="Numéro et nom de rue" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addressLine2">Complément</Label>
              <Input id="addressLine2" {...register("addressLine2")} placeholder="Appartement, bâtiment…" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="postalCode">Code postal</Label>
                <Input id="postalCode" {...register("postalCode")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">Ville</Label>
                <Input id="city" {...register("city")} />
              </div>
            </div>
          </div>

          {/* Représentant légal */}
          <div className="border-t pt-4 space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Représentant légal (si mineur)</p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="legalRepPhone">Téléphone</Label>
                <Input id="legalRepPhone" type="tel" {...register("legalRepPhone")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="legalRepEmail">Email</Label>
                <Input id="legalRepEmail" type="email" {...register("legalRepEmail")} />
              </div>
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

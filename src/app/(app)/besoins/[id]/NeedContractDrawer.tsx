"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { updateNeedContractFields, type ContractFields } from "@/app/(app)/besoins/actions";

type Props = {
  needId: string;
  initialValues: ContractFields;
  canEdit: boolean;
};

const CONTRACT_TYPES = [
  { value: "apprentissage", label: "Apprentissage" },
  { value: "professionnalisation", label: "Professionnalisation" },
  { value: "cdi", label: "CDI" },
  { value: "cdd", label: "CDD" },
];

const SALARY_REFS = [
  { value: "SMIC", label: "SMIC" },
  { value: "SMC", label: "SMC (salaire minimum conventionnel)" },
];

const OVERTIME_OPTIONS = [
  { value: "payées", label: "Payées" },
  { value: "récupérées", label: "Récupérées" },
];

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2 pb-1 border-b">
      {children}
    </p>
  );
}

export function NeedContractDrawer({ needId, initialValues, canEdit }: Props) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<ContractFields>(initialValues);
  const [isPending, startTransition] = useTransition();

  function set(key: keyof ContractFields, value: string) {
    setValues((v) => ({ ...v, [key]: value || undefined }));
  }

  function handleOpen() {
    setValues(initialValues);
    setOpen(true);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateNeedContractFields(needId, values);
      if (!result.success) {
        toast.error(result.error ?? "Erreur lors de la sauvegarde");
        return;
      }
      toast.success("Informations enregistrées");
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 h-8 text-xs"
        onClick={handleOpen}
        disabled={!canEdit}
      >
        <Pencil className="h-3.5 w-3.5" />
        Informations du contrat
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="max-w-lg">
          <SheetHeader>
            <SheetTitle>Informations du contrat</SheetTitle>
            <SheetClose />
          </SheetHeader>

          <SheetBody className="space-y-5">
            {/* Section Poste */}
            <div className="space-y-3">
              <SectionTitle>Poste</SectionTitle>

              <Field label="Type de contrat">
                <select
                  value={values.contractType ?? ""}
                  onChange={(e) => set("contractType", e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">— Sélectionner —</option>
                  {CONTRACT_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Durée hebdomadaire (heures)">
                <Input
                  placeholder="ex. 35"
                  value={values.weeklyHours ?? ""}
                  onChange={(e) => set("weeklyHours", e.target.value)}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Référence de salaire">
                  <select
                    value={values.salaryReference ?? ""}
                    onChange={(e) => set("salaryReference", e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">—</option>
                    {SALARY_REFS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
                {values.salaryReference === "SMC" && (
                  <Field label="Montant SMC (€/mois brut)">
                    <Input
                      placeholder="ex. 1 800"
                      value={values.smcAmount ?? ""}
                      onChange={(e) => set("smcAmount", e.target.value)}
                    />
                  </Field>
                )}
              </div>

              <Field label="Heures supplémentaires">
                <select
                  value={values.overtimeHandling ?? ""}
                  onChange={(e) => set("overtimeHandling", e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">—</option>
                  {OVERTIME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Date de fin de contrat">
                <Input
                  type="date"
                  value={values.endDate ?? ""}
                  onChange={(e) => set("endDate", e.target.value)}
                />
              </Field>
            </div>

            {/* Section Maître d'apprentissage */}
            <div className="space-y-3">
              <SectionTitle>Maître d&apos;apprentissage</SectionTitle>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Prénom">
                  <Input
                    placeholder="Prénom"
                    value={values.masterFirstName ?? ""}
                    onChange={(e) => set("masterFirstName", e.target.value)}
                  />
                </Field>
                <Field label="Nom d'usage">
                  <Input
                    placeholder="Nom"
                    value={values.masterLastName ?? ""}
                    onChange={(e) => set("masterLastName", e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Nom de naissance">
                <Input
                  placeholder="Si différent du nom d'usage"
                  value={values.masterBirthName ?? ""}
                  onChange={(e) => set("masterBirthName", e.target.value)}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Date de naissance">
                  <Input
                    type="date"
                    value={values.masterBirthDate ?? ""}
                    onChange={(e) => set("masterBirthDate", e.target.value)}
                  />
                </Field>
                <Field label="Fonction">
                  <Input
                    placeholder="ex. Responsable RH"
                    value={values.masterJobTitle ?? ""}
                    onChange={(e) => set("masterJobTitle", e.target.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Téléphone">
                  <Input
                    type="tel"
                    placeholder="06 xx xx xx xx"
                    value={values.masterPhone ?? ""}
                    onChange={(e) => set("masterPhone", e.target.value)}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    placeholder="email@entreprise.fr"
                    value={values.masterEmail ?? ""}
                    onChange={(e) => set("masterEmail", e.target.value)}
                  />
                </Field>
              </div>
            </div>

            {/* Section Avantages en nature */}
            <div className="space-y-3">
              <SectionTitle>Avantages en nature</SectionTitle>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Repas (€/repas)">
                  <Input
                    placeholder="ex. 4.50"
                    value={values.benefitFood ?? ""}
                    onChange={(e) => set("benefitFood", e.target.value)}
                  />
                </Field>
                <Field label="Logement (€/mois)">
                  <Input
                    placeholder="ex. 200"
                    value={values.benefitHousing ?? ""}
                    onChange={(e) => set("benefitHousing", e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Autres avantages">
                <Input
                  placeholder="ex. Voiture de fonction, mutuelle…"
                  value={values.benefitOther ?? ""}
                  onChange={(e) => set("benefitOther", e.target.value)}
                />
              </Field>
            </div>
          </SheetBody>

          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

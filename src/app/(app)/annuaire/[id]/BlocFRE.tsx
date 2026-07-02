"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCompanyFRE, type CompanyDetail } from "./actions";

type FREData = Pick<
  CompanyDetail,
  | "idcc"
  | "collectiveAgreement"
  | "opco"
  | "retirementFund"
  | "providentFund"
  | "legalRepFirstName"
  | "legalRepLastName"
>;

function ReadField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">
        {value || (
          <span className="text-muted-foreground/60 italic font-normal">—</span>
        )}
      </dd>
    </div>
  );
}

export function BlocFRE({
  companyId,
  initialData,
  canEdit,
}: {
  companyId: string;
  initialData: FREData;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, startSave] = useTransition();
  const [values, setValues] = useState({
    idcc: initialData.idcc ?? "",
    collectiveAgreement: initialData.collectiveAgreement ?? "",
    opco: initialData.opco ?? "",
    retirementFund: initialData.retirementFund ?? "",
    providentFund: initialData.providentFund ?? "",
    legalRepFirstName: initialData.legalRepFirstName ?? "",
    legalRepLastName: initialData.legalRepLastName ?? "",
  });

  const missingFields: string[] = [];
  if (!initialData.idcc) missingFields.push("IDCC");
  if (!initialData.collectiveAgreement) missingFields.push("Convention collective");
  if (!initialData.opco) missingFields.push("OPCO");
  if (!initialData.retirementFund) missingFields.push("Caisse de retraite");
  if (!initialData.providentFund) missingFields.push("Prévoyance");
  if (!initialData.legalRepFirstName || !initialData.legalRepLastName)
    missingFields.push("Représentant légal");

  function handleSave() {
    startSave(async () => {
      const result = await updateCompanyFRE(companyId, {
        idcc: values.idcc.trim() || null,
        collectiveAgreement: values.collectiveAgreement.trim() || null,
        opco: values.opco.trim() || null,
        retirementFund: values.retirementFund.trim() || null,
        providentFund: values.providentFund.trim() || null,
        legalRepFirstName: values.legalRepFirstName.trim() || null,
        legalRepLastName: values.legalRepLastName.trim() || null,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Données FRE mises à jour");
      setIsEditing(false);
      router.refresh();
    });
  }

  function handleCancel() {
    setValues({
      idcc: initialData.idcc ?? "",
      collectiveAgreement: initialData.collectiveAgreement ?? "",
      opco: initialData.opco ?? "",
      retirementFund: initialData.retirementFund ?? "",
      providentFund: initialData.providentFund ?? "",
      legalRepFirstName: initialData.legalRepFirstName ?? "",
      legalRepLastName: initialData.legalRepLastName ?? "",
    });
    setIsEditing(false);
  }

  const f =
    (field: keyof typeof values) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [field]: e.target.value }));

  const legalRep =
    initialData.legalRepFirstName || initialData.legalRepLastName
      ? `${initialData.legalRepFirstName ?? ""} ${initialData.legalRepLastName ?? ""}`.trim()
      : null;

  return (
    <section className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
        <h2 className="text-sm font-semibold">Données FRE / Contrat</h2>
        {!isEditing && canEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-7 text-xs"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Modifier
          </Button>
        )}
      </div>

      {missingFields.length > 0 && !isEditing && (
        <div className="mx-4 mt-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-800">
                Champs manquants
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {missingFields.join(", ")}
              </p>
            </div>
          </div>
        </div>
      )}

      {!isEditing ? (
        <dl className="px-4 py-3 space-y-3">
          <ReadField label="Code IDCC" value={initialData.idcc} />
          <ReadField
            label="Convention collective"
            value={initialData.collectiveAgreement}
          />
          <ReadField label="OPCO" value={initialData.opco} />
          <ReadField
            label="Caisse de retraite"
            value={initialData.retirementFund}
          />
          <ReadField label="Prévoyance" value={initialData.providentFund} />
          <ReadField label="Représentant légal" value={legalRep} />
        </dl>
      ) : (
        <div className="px-4 py-3 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Code IDCC</Label>
            <Input
              className="h-8 text-sm"
              value={values.idcc}
              onChange={f("idcc")}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Convention collective</Label>
            <Input
              className="h-8 text-sm"
              value={values.collectiveAgreement}
              onChange={f("collectiveAgreement")}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">OPCO</Label>
            <Input
              className="h-8 text-sm"
              value={values.opco}
              onChange={f("opco")}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Caisse de retraite</Label>
            <Input
              className="h-8 text-sm"
              value={values.retirementFund}
              onChange={f("retirementFund")}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Prévoyance</Label>
            <Input
              className="h-8 text-sm"
              value={values.providentFund}
              onChange={f("providentFund")}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Représentant légal</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                className="h-8 text-sm"
                placeholder="Prénom"
                value={values.legalRepFirstName}
                onChange={f("legalRepFirstName")}
              />
              <Input
                className="h-8 text-sm"
                placeholder="Nom"
                value={values.legalRepLastName}
                onChange={f("legalRepLastName")}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Annuler
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Enregistrer"
              )}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

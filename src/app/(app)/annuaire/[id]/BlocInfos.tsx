"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCompanyInfo, updateCompanyFRE, syncFromPappers, type CompanyDetail } from "./actions";

type Data = Pick<
  CompanyDetail,
  | "name" | "address" | "postalCode" | "city" | "phone" | "email" | "sector" | "website" | "notes"
  | "siret" | "siren" | "nafCode" | "legalForm" | "employeeRange" | "registrySyncedAt"
  | "idcc" | "collectiveAgreement" | "opco" | "retirementFund" | "providentFund"
  | "legalRepFirstName" | "legalRepLastName"
>;

function ReadField({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null | undefined;
  href?: string;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">
        {value ? (
          href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          <span className="text-muted-foreground/60 italic font-normal">—</span>
        )}
      </dd>
    </div>
  );
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 30) return `il y a ${days} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function BlocInfos({
  companyId,
  initialData,
  canEdit,
}: {
  companyId: string;
  initialData: Data;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [isEditingFRE, setIsEditingFRE] = useState(false);
  const [isSavingInfo, startSaveInfo] = useTransition();
  const [isSavingFRE, startSaveFRE] = useTransition();
  const [isSyncing, startSync] = useTransition();

  const [valuesInfo, setValuesInfo] = useState({
    name: initialData.name,
    address: initialData.address ?? "",
    postalCode: initialData.postalCode ?? "",
    city: initialData.city ?? "",
    phone: initialData.phone ?? "",
    email: initialData.email ?? "",
    sector: initialData.sector ?? "",
    website: initialData.website ?? "",
    notes: initialData.notes ?? "",
  });

  const [valuesFRE, setValuesFRE] = useState({
    idcc: initialData.idcc ?? "",
    collectiveAgreement: initialData.collectiveAgreement ?? "",
    opco: initialData.opco ?? "",
    retirementFund: initialData.retirementFund ?? "",
    providentFund: initialData.providentFund ?? "",
    legalRepFirstName: initialData.legalRepFirstName ?? "",
    legalRepLastName: initialData.legalRepLastName ?? "",
  });

  const isEditing = isEditingInfo || isEditingFRE;

  function handleSaveInfo() {
    if (!valuesInfo.name.trim()) { toast.error("La raison sociale est requise"); return; }
    startSaveInfo(async () => {
      const result = await updateCompanyInfo(companyId, {
        name: valuesInfo.name.trim(),
        address: valuesInfo.address.trim() || null,
        postalCode: valuesInfo.postalCode.trim() || null,
        city: valuesInfo.city.trim() || null,
        phone: valuesInfo.phone.trim() || null,
        email: valuesInfo.email.trim() || null,
        sector: valuesInfo.sector.trim() || null,
        website: valuesInfo.website.trim() || null,
        notes: valuesInfo.notes.trim() || null,
      });
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Informations mises à jour");
      setIsEditingInfo(false);
      router.refresh();
    });
  }

  function handleCancelInfo() {
    setValuesInfo({
      name: initialData.name,
      address: initialData.address ?? "",
      postalCode: initialData.postalCode ?? "",
      city: initialData.city ?? "",
      phone: initialData.phone ?? "",
      email: initialData.email ?? "",
      sector: initialData.sector ?? "",
      website: initialData.website ?? "",
      notes: initialData.notes ?? "",
    });
    setIsEditingInfo(false);
  }

  function handleSaveFRE() {
    startSaveFRE(async () => {
      const result = await updateCompanyFRE(companyId, {
        idcc: valuesFRE.idcc.trim() || null,
        collectiveAgreement: valuesFRE.collectiveAgreement.trim() || null,
        opco: valuesFRE.opco.trim() || null,
        retirementFund: valuesFRE.retirementFund.trim() || null,
        providentFund: valuesFRE.providentFund.trim() || null,
        legalRepFirstName: valuesFRE.legalRepFirstName.trim() || null,
        legalRepLastName: valuesFRE.legalRepLastName.trim() || null,
      });
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Données FRE mises à jour");
      setIsEditingFRE(false);
      router.refresh();
    });
  }

  function handleCancelFRE() {
    setValuesFRE({
      idcc: initialData.idcc ?? "",
      collectiveAgreement: initialData.collectiveAgreement ?? "",
      opco: initialData.opco ?? "",
      retirementFund: initialData.retirementFund ?? "",
      providentFund: initialData.providentFund ?? "",
      legalRepFirstName: initialData.legalRepFirstName ?? "",
      legalRepLastName: initialData.legalRepLastName ?? "",
    });
    setIsEditingFRE(false);
  }

  function handleSync() {
    startSync(async () => {
      const result = await syncFromPappers(companyId);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Données synchronisées depuis le registre public");
      router.refresh();
    });
  }

  const fi = (field: keyof typeof valuesInfo) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValuesInfo((v) => ({ ...v, [field]: e.target.value }));

  const ff = (field: keyof typeof valuesFRE) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setValuesFRE((v) => ({ ...v, [field]: e.target.value }));

  const websiteHref = initialData.website
    ? initialData.website.startsWith("http") ? initialData.website : `https://${initialData.website}`
    : undefined;

  const legalRep =
    initialData.legalRepFirstName || initialData.legalRepLastName
      ? `${initialData.legalRepFirstName ?? ""} ${initialData.legalRepLastName ?? ""}`.trim()
      : null;

  const missingFRE: string[] = [];
  if (!initialData.idcc) missingFRE.push("IDCC");
  if (!initialData.collectiveAgreement) missingFRE.push("Convention collective");
  if (!initialData.opco) missingFRE.push("OPCO");
  if (!initialData.retirementFund) missingFRE.push("Caisse de retraite");
  if (!initialData.providentFund) missingFRE.push("Prévoyance");
  if (!initialData.legalRepFirstName || !initialData.legalRepLastName) missingFRE.push("Représentant légal");

  return (
    <section className="rounded-lg border-2 border-primary/25 bg-card overflow-hidden shadow-sm">
      <div className="h-1 bg-primary/70" />

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b bg-primary/[0.03]">
        <h2 className="text-sm font-semibold">Informations</h2>
        {!isEditing && canEdit && (
          <Button
            variant="ghost" size="sm" className="gap-1.5 h-7 text-xs"
            onClick={() => setIsEditingInfo(true)}
          >
            <Pencil className="h-3.5 w-3.5" />Modifier
          </Button>
        )}
      </div>

      <div className="px-5 py-4 space-y-5">

        {/* ── Section Infos ── */}
        {isEditingInfo ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="co-name">Raison sociale</Label>
                <Input id="co-name" value={valuesInfo.name} onChange={fi("name")} autoFocus />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="co-address">Adresse</Label>
                <Input id="co-address" value={valuesInfo.address} onChange={fi("address")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-postal">Code postal</Label>
                <Input id="co-postal" value={valuesInfo.postalCode} onChange={fi("postalCode")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-city">Ville</Label>
                <Input id="co-city" value={valuesInfo.city} onChange={fi("city")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-phone">Téléphone</Label>
                <Input id="co-phone" type="tel" value={valuesInfo.phone} onChange={fi("phone")} placeholder="01 xx xx xx xx" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-email">Email</Label>
                <Input id="co-email" type="email" value={valuesInfo.email} onChange={fi("email")} placeholder="contact@entreprise.fr" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-sector">Secteur</Label>
                <Input id="co-sector" value={valuesInfo.sector} onChange={fi("sector")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-website">Site web</Label>
                <Input id="co-website" value={valuesInfo.website} onChange={fi("website")} placeholder="https://…" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="co-notes">Notes</Label>
                <textarea
                  id="co-notes"
                  value={valuesInfo.notes}
                  onChange={fi("notes")}
                  rows={3}
                  className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" size="sm" onClick={handleCancelInfo} disabled={isSavingInfo}>
                Annuler
              </Button>
              <Button type="button" size="sm" onClick={handleSaveInfo} disabled={isSavingInfo}>
                {isSavingInfo
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Enregistrement…</>
                  : "Enregistrer"}
              </Button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <ReadField label="Raison sociale" value={initialData.name} />
            <ReadField label="Secteur" value={initialData.sector} />
            <ReadField label="Adresse" value={initialData.address} />
            <ReadField label="Code postal" value={initialData.postalCode} />
            <ReadField label="Ville" value={initialData.city} />
            <ReadField label="Téléphone" value={initialData.phone} />
            <ReadField label="Email" value={initialData.email} />
            <ReadField label="Site web" value={initialData.website} href={websiteHref} />
            {initialData.notes && (
              <div className="col-span-2 pt-1 border-t">
                <dt className="text-xs text-muted-foreground mb-1">Notes</dt>
                <dd className="text-sm whitespace-pre-wrap">{initialData.notes}</dd>
              </div>
            )}
          </dl>
        )}

        {/* ── Registre public ── */}
        <div className="pt-2 border-t space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Registre public
            </p>
            {canEdit && (
              <div className="flex items-center gap-2">
                {initialData.registrySyncedAt && (
                  <span className="text-[11px] text-muted-foreground" suppressHydrationWarning>
                    Sync {relativeDate(initialData.registrySyncedAt)}
                  </span>
                )}
                <Button
                  variant="outline" size="sm" className="h-6 text-xs gap-1 px-2"
                  onClick={handleSync}
                  disabled={isSyncing || !initialData.siret}
                  title={!initialData.siret ? "SIRET manquant" : "Synchroniser depuis Pappers"}
                >
                  {isSyncing
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <RefreshCw className="h-3 w-3" />}
                  Pappers
                </Button>
              </div>
            )}
          </div>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            <ReadField label="SIRET" value={initialData.siret} />
            <ReadField label="SIREN" value={initialData.siren} />
            <ReadField label="Code NAF" value={initialData.nafCode} />
            <ReadField label="Forme juridique" value={initialData.legalForm} />
            <ReadField label="Effectifs" value={initialData.employeeRange} />
          </dl>
        </div>

        {/* ── FRE / Contrat ── */}
        <div className="pt-2 border-t space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              FRE / Contrat
            </p>
            {!isEditing && canEdit && (
              <Button
                variant="ghost" size="sm" className="gap-1.5 h-7 text-xs"
                onClick={() => setIsEditingFRE(true)}
              >
                <Pencil className="h-3.5 w-3.5" />Modifier
              </Button>
            )}
          </div>

          {missingFRE.length > 0 && !isEditingFRE && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">{missingFRE.join(", ")}</p>
            </div>
          )}

          {isEditingFRE ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Code IDCC</Label>
                  <Input className="h-8 text-sm" value={valuesFRE.idcc} onChange={ff("idcc")} autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">OPCO</Label>
                  <Input className="h-8 text-sm" value={valuesFRE.opco} onChange={ff("opco")} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Convention collective</Label>
                  <Input className="h-8 text-sm" value={valuesFRE.collectiveAgreement} onChange={ff("collectiveAgreement")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Caisse de retraite</Label>
                  <Input className="h-8 text-sm" value={valuesFRE.retirementFund} onChange={ff("retirementFund")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Prévoyance</Label>
                  <Input className="h-8 text-sm" value={valuesFRE.providentFund} onChange={ff("providentFund")} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Représentant légal</Label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input className="h-8 text-sm" placeholder="Prénom" value={valuesFRE.legalRepFirstName} onChange={ff("legalRepFirstName")} />
                    <Input className="h-8 text-sm" placeholder="Nom" value={valuesFRE.legalRepLastName} onChange={ff("legalRepLastName")} />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={handleCancelFRE} disabled={isSavingFRE}>
                  Annuler
                </Button>
                <Button type="button" size="sm" className="h-7 text-xs" onClick={handleSaveFRE} disabled={isSavingFRE}>
                  {isSavingFRE ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Enregistrer"}
                </Button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              <ReadField label="Code IDCC" value={initialData.idcc} />
              <ReadField label="OPCO" value={initialData.opco} />
              <ReadField label="Convention collective" value={initialData.collectiveAgreement} />
              <ReadField label="Caisse de retraite" value={initialData.retirementFund} />
              <ReadField label="Prévoyance" value={initialData.providentFund} />
              <ReadField label="Représentant légal" value={legalRep} />
            </dl>
          )}
        </div>

      </div>
    </section>
  );
}

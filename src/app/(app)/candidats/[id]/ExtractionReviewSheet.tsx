"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, FileText, User, Phone, Briefcase, GraduationCap, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { applyDocumentExtraction } from "./document-actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReviewField = {
  key: string;
  label: string;
  value: string;
  defaultChecked?: boolean;
  sensitive?: boolean;
};

type ReviewGroup = {
  id: string;
  label: string;
  icon: React.ReactNode;
  fields: ReviewField[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMonth(ym: string | undefined): string {
  if (!ym) return "?";
  const [y, m] = ym.split("-");
  if (!y) return ym;
  if (!m) return y;
  const months = ["jan", "fév", "mar", "avr", "mai", "juin", "juil", "aoû", "sep", "oct", "nov", "déc"];
  return `${months[parseInt(m) - 1] ?? m} ${y}`;
}

function buildGroups(documentType: string, data: Record<string, unknown>): ReviewGroup[] {
  const groups: ReviewGroup[] = [];

  if (documentType === "cv") {
    const contactFields: ReviewField[] = [];
    if (data.email) contactFields.push({ key: "email", label: "Email", value: data.email as string });
    if (data.phone) contactFields.push({ key: "phone", label: "Téléphone", value: data.phone as string });
    if (data.addressLine1) contactFields.push({ key: "addressLine1", label: "Adresse", value: data.addressLine1 as string });
    if (data.postalCode) contactFields.push({ key: "postalCode", label: "Code postal", value: data.postalCode as string });
    if (data.city) contactFields.push({ key: "city", label: "Ville", value: data.city as string });
    if (contactFields.length > 0) {
      groups.push({ id: "contact", label: "Contact", icon: <Phone className="h-4 w-4" />, fields: contactFields });
    }

    const skills = (data.skills as string[] | undefined) ?? [];
    if (skills.length > 0) {
      groups.push({
        id: "skills",
        label: "Compétences",
        icon: <Zap className="h-4 w-4" />,
        fields: skills.map((s, i) => ({ key: `skill_${i}`, label: s, value: "" })),
      });
    }

    const exps = (data.experiences as Array<Record<string, unknown>> | undefined) ?? [];
    if (exps.length > 0) {
      groups.push({
        id: "experiences",
        label: "Expériences",
        icon: <Briefcase className="h-4 w-4" />,
        fields: exps.map((e, i) => {
          const period = e.isCurrent
            ? `${fmtMonth(e.startMonth as string)} – en cours`
            : `${fmtMonth(e.startMonth as string)} – ${fmtMonth(e.endMonth as string)}`;
          const label = [e.jobTitle, e.company].filter(Boolean).join(" · ");
          return {
            key: `experience_${i}`,
            label: label || `Expérience ${i + 1}`,
            value: `${period}${e.contractType ? ` · ${e.contractType}` : ""}`,
          };
        }),
      });
    }

    const cvFormations = (data.formations as Array<Record<string, unknown>> | undefined) ?? [];
    if (cvFormations.length > 0) {
      groups.push({
        id: "formations",
        label: "Formations",
        icon: <GraduationCap className="h-4 w-4" />,
        fields: cvFormations.map((f, i) => {
          const period = f.isCurrent
            ? `${fmtMonth(f.startMonth as string)} – en cours`
            : `${fmtMonth(f.startMonth as string)} – ${fmtMonth(f.endMonth as string)}`;
          return {
            key: `formation_${i}`,
            label: [f.title, f.institution].filter(Boolean).join(" · ") || `Formation ${i + 1}`,
            value: period,
          };
        }),
      });
    }
  }

  if (documentType === "cni") {
    const identityFields: ReviewField[] = [];
    const add = (key: string, label: string, displayValue?: string) => {
      const raw = data[key];
      if (raw) identityFields.push({ key, label, value: displayValue ?? (raw as string) });
    };
    if (data.sex) {
      const civilite = (data.sex as string).toUpperCase() === "F" ? "Mme" : "M.";
      identityFields.push({ key: "sex", label: "Civilité", value: civilite });
    }
    add("firstName", "Prénom(s)");
    add("birthName", "Nom de naissance", (() => {
      const bn = data.birthName as string;
      const ln = data.lastName as string;
      return ln && ln !== bn ? `${bn} (nom d'usage : ${ln})` : bn;
    })());
    if (data.lastName && data.lastName !== data.birthName) {
      add("lastName", "Nom d'usage");
    }
    add("birthDate", "Date de naissance");
    add("birthCity", "Ville de naissance");
    add("birthDepartment", "Département");
    add("birthCountry", "Pays");
    add("nationality", "Nationalité");
    if (identityFields.length > 0) {
      groups.push({ id: "identity", label: "Identité", icon: <User className="h-4 w-4" />, fields: identityFields });
    }
  }

  if (documentType === "carte_vitale") {
    const protectedData = data._protected && typeof data._protected === "object"
      ? data._protected as Record<string, unknown>
      : null;
    const nirValue = typeof data.nir === "string"
      ? data.nir
      : typeof protectedData?.nirMasked === "string"
        ? protectedData.nirMasked
        : null;
    if (nirValue) {
      data.nir = nirValue;
      groups.push({
        id: "nir",
        label: "Sécurité sociale",
        icon: <ShieldCheck className="h-4 w-4" />,
        fields: [{ key: "nir", label: "Numéro de sécurité sociale (NIR)", value: data.nir as string }],
      });
    }
  }

  if (documentType === "diplome") {
    const diplomeFormations = (data.formations as Array<Record<string, unknown>> | undefined) ?? [];
    if (diplomeFormations.length > 0) {
      groups.push({
        id: "formations",
        label: "Formation",
        icon: <GraduationCap className="h-4 w-4" />,
        fields: diplomeFormations.map((f, i) => {
          const period = f.isCurrent
            ? `${fmtMonth(f.startMonth as string)} – en cours`
            : `${fmtMonth(f.startMonth as string)} – ${fmtMonth(f.endMonth as string)}`;
          return {
            key: `formation_${i}`,
            label: [f.title, f.institution].filter(Boolean).join(" · ") || `Formation ${i + 1}`,
            value: period,
          };
        }),
      });
    }
  }

  return groups.map((group) => group.id !== "nir"
    ? group
    : {
        ...group,
        fields: group.fields.map((field) => ({
          ...field,
          defaultChecked: false,
          sensitive: true,
        })),
      });
}

// ─── Component ────────────────────────────────────────────────────────────────

const DOC_TYPE_LABEL: Record<string, string> = {
  cv: "Curriculum Vitae",
  cni: "Carte Nationale d'Identité",
  carte_vitale: "Carte Vitale",
  diplome: "Diplôme",
};

export function ExtractionReviewSheet({
  documentId,
  documentType,
  extractedData,
  candidateId,
  open,
  onOpenChange,
  onApplied,
}: {
  documentId: string;
  documentType: string;
  extractedData: Record<string, unknown>;
  candidateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied: () => void;
}) {
  const groups = useMemo(() => buildGroups(documentType, extractedData), [documentType, extractedData]);
  const defaultKeys = useMemo(
    () => groups.flatMap((g) => g.fields.filter((f) => f.defaultChecked !== false).map((f) => f.key)),
    [groups],
  );
  const [checked, setChecked] = useState<Set<string>>(() => new Set(defaultKeys));
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setChecked(new Set(defaultKeys));
  }, [defaultKeys, documentId, open]);

  function toggleKey(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleGroup(groupId: string) {
    const groupKeys = groups.find((g) => g.id === groupId)?.fields.map((f) => f.key) ?? [];
    const allChecked = groupKeys.every((k) => checked.has(k));
    setChecked((prev) => {
      const next = new Set(prev);
      if (allChecked) groupKeys.forEach((k) => next.delete(k));
      else groupKeys.forEach((k) => next.add(k));
      return next;
    });
  }

  function handleApply() {
    const keys = Array.from(checked);
    if (keys.length === 0) { onOpenChange(false); return; }
    startTransition(async () => {
      const result = await applyDocumentExtraction(documentId, candidateId, keys);
      if (!result.success) {
        toast.error(result.error ?? "Erreur lors de l'import");
        return;
      }
      toast.success("Données importées avec succès");
      onOpenChange(false);
      onApplied();
    });
  }

  const hasData = groups.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:w-[540px] flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 py-5 border-b shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <SheetTitle className="text-base">
              Données extraites — {DOC_TYPE_LABEL[documentType] ?? documentType}
            </SheetTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Décochez les champs à ne pas importer. Les données existantes seront écrasées pour les cases cochées.
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {!hasData ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Aucune donnée exploitable trouvée dans ce document.
              </p>
            </div>
          ) : (
            groups.map((group) => {
              const groupKeys = group.fields.map((f) => f.key);
              const allGroupChecked = groupKeys.every((k) => checked.has(k));
              const someGroupChecked = groupKeys.some((k) => checked.has(k));

              return (
                <div key={group.id}>
                  <button
                    type="button"
                    className="flex items-center gap-2 mb-2 w-full text-left"
                    onClick={() => toggleGroup(group.id)}
                  >
                    <input
                      type="checkbox"
                      readOnly
                      checked={allGroupChecked}
                      ref={(el) => {
                        if (el) el.indeterminate = someGroupChecked && !allGroupChecked;
                      }}
                      className="h-4 w-4 rounded border-gray-300 accent-primary pointer-events-none shrink-0"
                    />
                    <span className="text-muted-foreground">{group.icon}</span>
                    <span className="text-sm font-semibold">{group.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {groupKeys.filter((k) => checked.has(k)).length}/{groupKeys.length}
                    </span>
                  </button>

                  <div className="space-y-0.5 pl-5">
                    {group.fields.map((field) => (
                      <label
                        key={field.key}
                        className="flex items-start gap-3 py-2 px-3 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={checked.has(field.key)}
                          onChange={() => toggleKey(field.key)}
                          className="h-4 w-4 mt-0.5 rounded border-gray-300 accent-primary shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          {field.value ? (
                            <>
                              <p className="text-sm font-medium truncate">{field.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {field.value}
                                {field.sensitive ? " - masque par defaut" : ""}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm">{field.label}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <SheetFooter className="px-6 py-4 border-t shrink-0 flex-row gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Annuler
          </Button>
          <Button
            onClick={handleApply}
            disabled={isPending || checked.size === 0 || !hasData}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Import en cours…
              </>
            ) : (
              `Importer${checked.size > 0 ? ` (${checked.size})` : ""}`
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

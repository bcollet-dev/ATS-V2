"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Pencil,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { YpareoDraftField, YpareoDraftSection, YpareoPlacementDraft } from "@/lib/ypareo/placement-draft";
import { updateCerfaField } from "./cerfa-actions";

type Props = {
  draft: YpareoPlacementDraft | null;
  error?: string | null;
  contractAction?: ReactNode;
  canEdit?: boolean;
};

type SectionMeta = {
  source: string;
  href: string | null;
  icon: ReactNode;
};

const EDITABLE_FIELDS: Record<string, Set<string>> = {
  Employeur: new Set([
    "Nom ou denomination",
    "SIRET",
    "Adresse d'execution",
    "Telephone",
    "Courriel",
    "Type employeur",
    "Forme juridique",
    "Code APE",
    "Effectif",
    "Code IDCC",
    "Convention collective",
    "OPCO",
    "Caisse retraite complementaire",
    "Representant employeur",
    "Contact entreprise",
    "Fonction contact",
    "Telephone contact",
    "Courriel contact",
  ]),
  Apprenti: new Set([
    "Nom de naissance",
    "Nom d'usage",
    "Premier prenom",
    "Date de naissance",
    "Civilite / sexe",
    "Adresse",
    "Departement de naissance",
    "Commune de naissance",
    "Pays de naissance",
    "Nationalite",
    "Regime social",
    "Situation avant ce contrat",
    "Dernier diplome ou titre prepare",
    "Derniere classe / annee suivie",
    "Intitule precis du dernier diplome ou titre prepare",
    "Diplome ou titre le plus eleve obtenu",
    "Telephone",
    "Courriel",
    "RQTH",
  ]),
  "Representant legal": new Set([
    "Nom et prenom",
    "Lien avec l'apprenti",
    "Telephone",
    "Courriel",
  ]),
  "Maitre d'apprentissage": new Set([
    "Nom de naissance",
    "Nom d'usage",
    "Prenom",
    "Date de naissance",
    "Courriel",
    "Telephone",
    "Emploi occupe",
    "Diplome le plus eleve obtenu",
    "Niveau du diplome le plus eleve",
  ]),
  Contrat: new Set([
    "Type de contrat ou avenant",
    "Date de conclusion",
    "Date de debut d'execution",
    "Date de debut chez l'employeur",
    "Fait a",
    "Date de fin",
    "Duree hebdomadaire",
    "Reference de salaire",
    "Montant SMC",
    "Salaire brut mensuel",
    "Salaire brut horaire",
    "Avantage nourriture",
    "Avantage logement",
    "Autre avantage",
    "Heures supplementaires",
  ]),
  Formation: new Set([
    "Besoin",
    "Ville du besoin",
    "Code RNCP",
  ]),
};

function isEditable(sectionTitle: string, label: string) {
  return Boolean(
    EDITABLE_FIELDS[sectionTitle]?.has(label) ||
    (sectionTitle === "Contrat" && /^Remuneration \d+ - (Debut|Fin|Pourcentage|Base)$/.test(label)),
  );
}

function missingFields(draft: YpareoPlacementDraft) {
  return draft.sections.flatMap((section) =>
    section.fields
      .filter((field) => field.required && !field.value?.trim())
      .map((field) => `${section.title} - ${field.label}`),
  );
}

function sectionMeta(section: YpareoDraftSection, draft: YpareoPlacementDraft): SectionMeta {
  if (section.title === "Apprenti" || section.title === "Representant legal") {
    return {
      source: "Fiche candidat",
      href: draft.candidateId ? `/candidats/${draft.candidateId}` : null,
      icon: <UserRound className="h-3.5 w-3.5" />,
    };
  }

  if (section.title === "Employeur") {
    return {
      source: "Fiche entreprise",
      href: draft.companyId ? `/annuaire/${draft.companyId}` : null,
      icon: <Building2 className="h-3.5 w-3.5" />,
    };
  }

  if (section.title === "Depot") {
    return {
      source: "Ypareo",
      href: null,
      icon: <FileText className="h-3.5 w-3.5" />,
    };
  }

  return {
    source: "Fiche besoin",
    href: draft.needId ? `/besoins/${draft.needId}` : null,
    icon: <FileText className="h-3.5 w-3.5" />,
  };
}

function SourcePill({ meta }: { meta: SectionMeta }) {
  const content = (
    <>
      {meta.icon}
      <span>{meta.source}</span>
      {meta.href && <ExternalLink className="h-3 w-3" />}
    </>
  );

  const className = "inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground";

  if (!meta.href) return <span className={className}>{content}</span>;
  return (
    <Link href={meta.href as `/candidats/${string}` | `/annuaire/${string}` | `/besoins/${string}`} className={className}>
      {content}
    </Link>
  );
}

function EditableValue({
  draft,
  sectionTitle,
  field,
  canEdit,
  onSaved,
}: {
  draft: YpareoPlacementDraft;
  sectionTitle: string;
  field: YpareoDraftField;
  canEdit: boolean;
  onSaved: (sectionTitle: string, label: string, value: string | null) => void;
}) {
  const router = useRouter();
  const editable = canEdit && isEditable(sectionTitle, field.label);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(field.value ?? "");
  const [isPending, startTransition] = useTransition();
  const isMissing = Boolean(field.required && !field.value?.trim());

  useEffect(() => {
    setValue(field.value ?? "");
  }, [field.value]);

  function commit() {
    if (!editable || isPending) return;
    const nextValue = value.trim();
    const previousValue = field.value ?? "";
    if (nextValue === previousValue) {
      setEditing(false);
      return;
    }

    startTransition(async () => {
      const result = await updateCerfaField({
        needId: draft.needId ?? "",
        candidateId: draft.candidateId,
        sectionTitle,
        label: field.label,
        value: nextValue,
      });
      if (!result.success) {
        toast.error(result.error);
        setValue(previousValue);
        setEditing(false);
        return;
      }
      onSaved(sectionTitle, field.label, result.value);
      toast.success("Champ CERFA enregistré");
      setEditing(false);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") {
            setValue(field.value ?? "");
            setEditing(false);
          }
        }}
        disabled={isPending}
        className={cn(
          "h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-ring",
          isMissing && "border-amber-300 bg-amber-50",
        )}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={!editable || isPending}
      onClick={() => editable && setEditing(true)}
      className={cn(
        "group flex w-full min-w-0 items-center justify-between gap-2 rounded-sm text-left text-sm",
        field.value ? "text-foreground" : "text-muted-foreground",
        isMissing && "font-medium text-amber-800",
        editable && "hover:text-primary",
        !editable && "cursor-default",
      )}
    >
      <span className="min-w-0 break-words">
        {field.value || (field.required ? "A compléter" : "Non renseigné")}
      </span>
      {editable && (
        <span className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
        </span>
      )}
    </button>
  );
}

export function BlocCerfa({ draft, error, contractAction, canEdit = false }: Props) {
  const [currentDraft, setCurrentDraft] = useState(draft);

  useEffect(() => {
    setCurrentDraft(draft);
  }, [draft]);

  function updateLocalDraft(sectionTitle: string, label: string, value: string | null) {
    setCurrentDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        sections: current.sections.map((section) => section.title !== sectionTitle
          ? section
          : {
              ...section,
              fields: section.fields.map((field) => field.label !== label
                ? field
                : { ...field, value }),
            }),
      };
    });
  }

  const missing = currentDraft ? missingFields(currentDraft) : [];
  const requiredTotal = currentDraft
    ? currentDraft.sections.reduce((count, section) => count + section.fields.filter((field) => field.required).length, 0)
    : 0;
  const requiredDone = requiredTotal - missing.length;

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">CERFA / Ypareo</h2>
          </div>
          {currentDraft && (
            <p className="mt-1 text-xs text-muted-foreground">
              {currentDraft.title} - {currentDraft.subtitle}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {currentDraft && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
                missing.length === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
              )}
            >
              {missing.length === 0 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              {requiredDone}/{requiredTotal} requis
            </span>
          )}
          {contractAction}
        </div>
      </div>

      <div className="space-y-4 p-4">
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {currentDraft?.blockingIssues.length ? (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{currentDraft.blockingIssues.join(" ")}</span>
          </div>
        ) : null}

        {currentDraft?.warnings.length ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{currentDraft.warnings.join(" ")}</span>
          </div>
        ) : null}

        {!currentDraft && !error && (
          <p className="text-sm text-muted-foreground">Aucun dossier CERFA disponible.</p>
        )}

        {currentDraft && (
          <div className="grid gap-4 xl:grid-cols-2">
            {currentDraft.sections.map((section) => {
              const meta = sectionMeta(section, currentDraft);
              return (
                <section key={section.title} className="overflow-hidden rounded-md border bg-background">
                  <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
                    <h3 className="min-w-0 truncate text-sm font-semibold">{section.title}</h3>
                    <SourcePill meta={meta} />
                  </div>
                  <div className="divide-y">
                    {section.fields.map((field) => {
                      const isMissing = Boolean(field.required && !field.value?.trim());
                      return (
                        <div
                          key={`${section.title}-${field.label}`}
                          className={cn(
                            "grid gap-2 px-3 py-2 text-sm sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] sm:gap-3",
                            isMissing && "bg-amber-50/60",
                          )}
                        >
                          <div className="min-w-0">
                            <span className="block truncate text-xs text-muted-foreground">
                              {field.label}
                              {field.required && <span className="ml-1 text-destructive">*</span>}
                            </span>
                          </div>
                          <EditableValue
                            draft={currentDraft}
                            sectionTitle={section.title}
                            field={field}
                            canEdit={canEdit}
                            onSaved={updateLocalDraft}
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

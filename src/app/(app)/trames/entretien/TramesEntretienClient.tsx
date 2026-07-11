"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
  Loader2,
  Pencil,
  Plus,
  PlusCircle,
  Tag,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Modal, ModalBody, ModalClose, ModalContent, ModalFooter, ModalHeader, ModalTitle,
} from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import {
  POSITIONING_SUBCATEGORY,
  QUESTION_KIND_LABELS,
  isPositioningSubcategory,
  type InterviewQuestion,
  type InterviewQuestionKind,
} from "@/lib/interview-grid";
import {
  saveInterviewTrame,
  toggleTrameActive,
  deleteInterviewTrame,
  type TrameRow,
} from "@/app/(app)/entretiens/actions";

const SELECT_CLASS = cn(
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
  "focus:outline-none focus:ring-1 focus:ring-ring"
);

const NEW_SUBCATEGORY = "__new__";

function newQuestion(kind: InterviewQuestionKind): InterviewQuestion {
  const base = { id: crypto.randomUUID(), label: "", kind };
  if (kind === "single_choice" || kind === "multiple_choice") return { ...base, options: ["", ""] };
  if (kind === "matrix") return { ...base, rows: [""], columns: ["1", "2", "3", "4", "5"] };
  return base;
}

// ─── Éditeur de liste de chaînes (options / lignes / colonnes) ────────────────

function StringListEditor({
  label,
  values,
  onChange,
  addLabel,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  addLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="space-y-1.5">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <Input
              value={value}
              onChange={(e) => {
                const next = [...values];
                next[index] = e.target.value;
                onChange(next);
              }}
              className="h-8 text-sm"
            />
            <button
              type="button"
              onClick={() => onChange(values.filter((_, i) => i !== index))}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Supprimer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => onChange([...values, ""])}
        >
          <Plus className="h-3 w-3" />
          {addLabel}
        </Button>
      </div>
    </div>
  );
}

// ─── Carte d'édition d'une question ───────────────────────────────────────────

function QuestionEditor({
  question,
  index,
  total,
  onChange,
  onMove,
  onDelete,
}: {
  question: InterviewQuestion;
  index: number;
  total: number;
  onChange: (q: InterviewQuestion) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <span className="mt-2 shrink-0 text-xs font-semibold text-muted-foreground">
          {index + 1}.
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <Input
            placeholder="Intitulé de la question"
            value={question.label}
            onChange={(e) => onChange({ ...question, label: e.target.value })}
            className="h-8 text-sm"
          />
          <select
            value={question.kind}
            onChange={(e) => {
              const kind = e.target.value as InterviewQuestionKind;
              onChange({ ...newQuestion(kind), id: question.id, label: question.label });
            }}
            className={cn(SELECT_CLASS, "h-8 w-auto text-xs")}
          >
            {Object.entries(QUESTION_KIND_LABELS).map(([kind, label]) => (
              <option key={kind} value={kind}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
            title="Monter"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
            title="Descendre"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Supprimer la question"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {(question.kind === "single_choice" || question.kind === "multiple_choice") && (
        <StringListEditor
          label="Options de réponse"
          values={question.options ?? []}
          onChange={(options) => onChange({ ...question, options })}
          addLabel="Ajouter une option"
        />
      )}

      {question.kind === "matrix" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StringListEditor
            label="Lignes (questions à évaluer)"
            values={question.rows ?? []}
            onChange={(rows) => onChange({ ...question, rows })}
            addLabel="Ajouter une ligne"
          />
          <StringListEditor
            label="Colonnes (échelle de réponse)"
            values={question.columns ?? []}
            onChange={(columns) => onChange({ ...question, columns })}
            addLabel="Ajouter une colonne"
          />
        </div>
      )}

      {question.kind === "score" && (
        <p className="text-xs text-muted-foreground">Note de 1 à 5 avec commentaire optionnel.</p>
      )}
      {question.kind === "text" && (
        <p className="text-xs text-muted-foreground">Réponse libre rédigée par l'évaluateur.</p>
      )}
    </div>
  );
}

// ─── Éditeur de trame ─────────────────────────────────────────────────────────

type EditorState = {
  id?: string;
  name: string;
  subcategory: string;
  newSubcategory: string;
  cursusId: string;
  questions: InterviewQuestion[];
};

function emptyEditor(): EditorState {
  return {
    name: "",
    subcategory: POSITIONING_SUBCATEGORY,
    newSubcategory: "",
    cursusId: "",
    questions: [newQuestion("score")],
  };
}

function editorFromTrame(trame: TrameRow): EditorState {
  return {
    id: trame.id,
    name: trame.name,
    subcategory: trame.subcategory,
    newSubcategory: "",
    cursusId: trame.cursusId ?? "",
    questions: trame.questions,
  };
}

function TrameEditor({
  initial,
  subcategories,
  cursusOptions,
  onClose,
}: {
  initial: EditorState;
  subcategories: string[];
  cursusOptions: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [isSaving, startSave] = useTransition();

  const effectiveSubcategory =
    state.subcategory === NEW_SUBCATEGORY ? state.newSubcategory.trim() : state.subcategory;

  function handleSave() {
    startSave(async () => {
      const result = await saveInterviewTrame({
        id: state.id,
        name: state.name,
        subcategory: effectiveSubcategory,
        cursusId: state.cursusId || null,
        questions: state.questions.map((q) => ({
          ...q,
          label: q.label.trim(),
          options: q.options?.map((o) => o.trim()).filter(Boolean),
          rows: q.rows?.map((r) => r.trim()).filter(Boolean),
          columns: q.columns?.map((c) => c.trim()).filter(Boolean),
        })),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(state.id ? "Trame mise à jour" : "Trame créée");
      router.refresh();
      onClose();
    });
  }

  function updateQuestion(index: number, q: InterviewQuestion) {
    setState((s) => ({ ...s, questions: s.questions.map((old, i) => (i === index ? q : old)) }));
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    setState((s) => {
      const next = [...s.questions];
      const target = index + direction;
      if (target < 0 || target >= next.length) return s;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...s, questions: next };
    });
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3.5">
        <h2 className="text-sm font-semibold">
          {state.id ? "Modifier la trame" : "Nouvelle trame d'entretien"}
        </h2>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClose} disabled={isSaving}>
          Fermer
        </Button>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="trame-name">Nom de la trame</Label>
            <Input
              id="trame-name"
              value={state.name}
              onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
              placeholder="Ex. Positionnement Bachelor RH"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trame-subcategory">Sous-catégorie</Label>
            <select
              id="trame-subcategory"
              value={state.subcategory}
              onChange={(e) => setState((s) => ({ ...s, subcategory: e.target.value }))}
              className={SELECT_CLASS}
            >
              {subcategories.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value={NEW_SUBCATEGORY}>+ Nouvelle sous-catégorie…</option>
            </select>
            {state.subcategory === NEW_SUBCATEGORY && (
              <Input
                value={state.newSubcategory}
                onChange={(e) => setState((s) => ({ ...s, newSubcategory: e.target.value }))}
                placeholder="Nom de la sous-catégorie"
                className="mt-1.5"
              />
            )}
            {isPositioningSubcategory(effectiveSubcategory) && (
              <p className="text-xs text-muted-foreground">
                Pilote l'admission : non présent → PVPP, finalisation → Admissible ou Refus + motif.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trame-cursus">Cursus (optionnel)</Label>
            <select
              id="trame-cursus"
              value={state.cursusId}
              onChange={(e) => setState((s) => ({ ...s, cursusId: e.target.value }))}
              className={SELECT_CLASS}
            >
              <option value="">— Trame générique (sans cursus)</option>
              {cursusOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Questions</Label>
          <div className="space-y-2">
            {state.questions.map((q, index) => (
              <QuestionEditor
                key={q.id}
                question={q}
                index={index}
                total={state.questions.length}
                onChange={(updated) => updateQuestion(index, updated)}
                onMove={(direction) => moveQuestion(index, direction)}
                onDelete={() =>
                  setState((s) => ({ ...s, questions: s.questions.filter((_, i) => i !== index) }))
                }
              />
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setState((s) => ({ ...s, questions: [...s.questions, newQuestion("score")] }))}
          >
            <PlusCircle className="h-4 w-4" />
            Ajouter une question
          </Button>
        </div>

        <div className="flex justify-end gap-2 border-t pt-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Annuler
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || !state.name.trim() || !effectiveSubcategory}>
            {isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TramesEntretienClient({
  initialTrames,
  initialSubcategories,
  cursusOptions,
  canManage,
}: {
  initialTrames: TrameRow[];
  initialSubcategories: string[];
  cursusOptions: { id: string; name: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TrameRow | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [isToggling, startToggle] = useTransition();

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startDelete(async () => {
      const result = await deleteInterviewTrame(target.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Trame supprimée");
      setDeleteTarget(null);
      router.refresh();
    });
  }

  function handleToggle(trame: TrameRow) {
    startToggle(async () => {
      const result = await toggleTrameActive(trame.id, !trame.active);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Trames d'entretien</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {canManage
              ? "Définissez les questionnaires que les recruteurs déroulent en entretien"
              : "Consultation — la gestion des trames est réservée à la direction"}
          </p>
        </div>
        {canManage && !editor && (
          <Button className="gap-1.5" onClick={() => setEditor(emptyEditor())}>
            <PlusCircle className="h-4 w-4" />
            Nouvelle trame
          </Button>
        )}
      </div>

      {editor && (
        <TrameEditor
          initial={editor}
          subcategories={[
            ...initialSubcategories,
            ...(editor.subcategory && !initialSubcategories.includes(editor.subcategory) && editor.subcategory !== NEW_SUBCATEGORY
              ? [editor.subcategory]
              : []),
          ]}
          cursusOptions={cursusOptions}
          onClose={() => setEditor(null)}
        />
      )}

      {initialTrames.length === 0 && !editor ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <ClipboardList className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Aucune trame d'entretien</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canManage
              ? "Créez une première trame « Entretien de positionnement » pour lancer le processus d'admission."
              : "La direction n'a pas encore défini de trame."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {initialTrames.map((trame) => (
            <div
              key={trame.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border bg-card px-4 py-3",
                !trame.active && "opacity-60"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{trame.name}</span>
                  <Badge
                    className={cn(
                      "border-0 px-1.5 py-0.5 text-xs",
                      isPositioningSubcategory(trame.subcategory)
                        ? "bg-blue-100 text-blue-700"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {trame.subcategory}
                  </Badge>
                  {!trame.active && (
                    <Badge className="border-0 bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      Inactive
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    {trame.cursusName ?? "Générique"}
                  </span>
                  <span>
                    {trame.questions.length} question{trame.questions.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => handleToggle(trame)}
                    disabled={isToggling}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                    title={trame.active ? "Désactiver" : "Activer"}
                  >
                    {trame.active
                      ? <ToggleRight className="h-5 w-5 text-primary" />
                      : <ToggleLeft className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={() => setEditor(editorFromTrame(trame))}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title="Modifier"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(trame)}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={deleteTarget !== null} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle>Supprimer cette trame ?</ModalTitle>
            <ModalClose />
          </ModalHeader>
          <ModalBody>
            <p className="text-sm">
              Vous allez supprimer <span className="font-medium">{deleteTarget?.name}</span>.
            </p>
            <p className="text-sm text-muted-foreground">
              Les entretiens déjà passés avec cette trame conservent leur copie des questions et restent consultables.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Annuler
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Supprimer
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

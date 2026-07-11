"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Search, Loader2, Archive, Trash2, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose, SheetBody, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { TiptapEditor, useTiptapEditor } from "./TiptapEditor";
import {
  createMailTemplate, updateMailTemplate, archiveMailTemplate, deleteMailTemplate,
  setDefaultCvNotification, unsetDefaultCvNotification,
  type MailTemplateRow,
} from "./actions";

// ─── Variables ────────────────────────────────────────────────────────────────

const VARIABLES = [
  { key: "prenom_candidat",    label: "Prénom candidat",    example: "Baptiste" },
  { key: "nom_candidat",       label: "Nom candidat",       example: "COLLET" },
  { key: "email_candidat",     label: "Email candidat",     example: "b.collet@gmail.com" },
  { key: "telephone_candidat", label: "Téléphone candidat", example: "06 12 34 56 78" },
  { key: "cursus_candidat",    label: "Cursus candidat",    example: "BTS Management" },
  { key: "ville_candidat",     label: "Ville candidat",     example: "Lyon" },
  { key: "nom_besoin",         label: "Nom du besoin",      example: "Assistant RH" },
  { key: "titre_poste",        label: "Titre du poste",     example: "Assistant RH" },
  { key: "ville_poste",        label: "Ville du poste",     example: "Paris" },
  { key: "date_debut",         label: "Date de début",      example: "01/09/2026" },
  { key: "date_fin",           label: "Date de fin",        example: "31/08/2028" },
  { key: "type_contrat",       label: "Type de contrat",    example: "Apprentissage" },
  { key: "entreprise_associee", label: "Entreprise associee", example: "EDA Groupe" },
  { key: "nom_entreprise",     label: "Nom entreprise",     example: "EDA Groupe" },
  { key: "ville_entreprise",   label: "Ville entreprise",   example: "Paris" },
  { key: "siret_entreprise",   label: "SIRET entreprise",   example: "123 456 789 00012" },
  { key: "prenom_contact",     label: "Prénom contact",     example: "Marie" },
  { key: "nom_contact",        label: "Nom contact",        example: "DUPONT" },
  { key: "prenom_consultant",  label: "Prénom consultant",  example: "Jean" },
  { key: "nom_consultant",     label: "Nom consultant",     example: "MARTIN" },
  { key: "nom_ecole",          label: "École",              example: "EDA Groupe" },
] as const;

const AUDIENCE_OPTIONS = [
  { value: "all",       label: "Tous" },
  { value: "candidate", label: "Candidat" },
  { value: "company",   label: "Entreprise" },
] as const;

const CAN_EDIT_ROLES = new Set(["admin", "team_leader", "admissions"]);

// ─── Category combobox ────────────────────────────────────────────────────────

function CategoryCombobox({
  value,
  onChange,
  suggestions,
  readOnly,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  readOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const filtered = suggestions.filter((s) =>
    s.toLowerCase().includes(value.toLowerCase())
  );
  const showCreate = !readOnly && value.trim() && !suggestions.some(
    (s) => s.toLowerCase() === value.toLowerCase()
  );

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        readOnly={readOnly}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={readOnly ? "Aucune catégorie" : "Catégorie…"}
        className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
      />
      {open && (filtered.length > 0 || showCreate) && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border bg-popover shadow-md overflow-hidden">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={() => { onChange(s); setOpen(false); }}
              className="flex w-full px-3 py-1.5 text-sm hover:bg-accent text-left"
            >
              {s}
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              onMouseDown={() => setOpen(false)}
              className="flex w-full px-3 py-1.5 text-sm hover:bg-accent text-left text-primary"
            >
              Créer &ldquo;{value.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Inner form (keyed to reset Tiptap on template change) ───────────────────

function TrameForm({
  template,
  existingCategories,
  role,
  onSaved,
  onArchived,
  onDeleted,
  onDefaultToggled,
  onClose,
}: {
  template: MailTemplateRow | null;
  existingCategories: string[];
  role: string;
  onSaved: (t: MailTemplateRow, isNew: boolean) => void;
  onArchived: (id: string) => void;
  onDeleted: (id: string) => void;
  onDefaultToggled: (id: string, isDefault: boolean) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [category, setCategory] = useState(template?.category ?? "");
  const [audience, setAudience] = useState<"candidate" | "company" | "need" | "all">(
    template?.audience ?? "all"
  );
  const [varSearch, setVarSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const editor = useTiptapEditor(template?.body ?? "");
  const lastFocusedRef = useRef<"subject" | "body">("body");
  const subjectInputRef = useRef<HTMLInputElement>(null);

  const canEdit = CAN_EDIT_ROLES.has(role);
  const isAdmin = role === "admin";
  const isEditing = !!template;
  const isArchived = template ? !template.active : false;

  const filteredVars = VARIABLES.filter(
    (v) =>
      !varSearch.trim() ||
      v.label.toLowerCase().includes(varSearch.toLowerCase()) ||
      v.key.toLowerCase().includes(varSearch.toLowerCase())
  );

  function insertVariable(key: string) {
    const token = `{{${key}}}`;
    if (lastFocusedRef.current === "subject") {
      const input = subjectInputRef.current;
      if (!input) return;
      const start = input.selectionStart ?? subject.length;
      const end = input.selectionEnd ?? subject.length;
      const newValue = subject.slice(0, start) + token + subject.slice(end);
      setSubject(newValue);
      requestAnimationFrame(() => {
        input.focus();
        const pos = start + token.length;
        input.setSelectionRange(pos, pos);
      });
    } else {
      if (!editor) return;
      editor.chain().focus().insertContent(token).run();
    }
  }

  function handleSave() {
    if (!name.trim() || !subject.trim()) {
      toast.error("Le nom et l'objet sont obligatoires");
      return;
    }
    const body = editor?.getHTML() ?? "";
    const data = {
      name: name.trim(),
      subject: subject.trim(),
      body,
      category: category.trim() || null,
      audience,
    };

    startTransition(async () => {
      if (isEditing) {
        const result = await updateMailTemplate(template.id, data);
        if (!result.success) { toast.error(result.error); return; }
        toast.success("Trame mise à jour");
        onSaved(
          { ...template, ...data, category: data.category, updatedAt: new Date().toISOString() },
          false
        );
      } else {
        const result = await createMailTemplate(data);
        if (!result.success) { toast.error(result.error); return; }
        toast.success("Trame créée");
        onSaved(result.data, true);
      }
      onClose();
    });
  }

  function handleArchive() {
    if (!template) return;
    startTransition(async () => {
      const result = await archiveMailTemplate(template.id);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Trame archivée");
      onArchived(template.id);
      onClose();
    });
  }

  function handleDelete() {
    if (!template) return;
    startTransition(async () => {
      const result = await deleteMailTemplate(template.id);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Trame supprimée");
      onDeleted(template.id);
      onClose();
    });
  }

  function handleToggleDefault() {
    if (!template) return;
    startTransition(async () => {
      if (template.isDefaultCvNotification) {
        const result = await unsetDefaultCvNotification(template.id);
        if (!result.success) { toast.error(result.error); return; }
        toast.success("Notification CV désactivée");
        onDefaultToggled(template.id, false);
      } else {
        const result = await setDefaultCvNotification(template.id);
        if (!result.success) { toast.error(result.error); return; }
        toast.success("Trame définie comme notification CV par défaut");
        onDefaultToggled(template.id, true);
      }
    });
  }

  return (
    <>
      <SheetBody className="space-y-4">
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="trame-name">
            Nom <span className="text-destructive">*</span>
          </Label>
          <input
            id="trame-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            readOnly={!canEdit}
            placeholder="Ex : Envoi CV alternance BTS"
            className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground read-only:bg-muted read-only:cursor-default"
          />
        </div>

        {/* Subject */}
        <div className="space-y-1.5">
          <Label htmlFor="trame-subject">
            Objet <span className="text-destructive">*</span>
          </Label>
          <input
            id="trame-subject"
            ref={subjectInputRef}
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onFocus={() => { lastFocusedRef.current = "subject"; }}
            readOnly={!canEdit}
            placeholder="Ex : Candidature alternance – {{prenom_candidat}} {{nom_candidat}}"
            className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground read-only:bg-muted read-only:cursor-default"
          />
        </div>

        {/* Category + Audience */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <CategoryCombobox
              value={category}
              onChange={setCategory}
              suggestions={existingCategories}
              readOnly={!canEdit}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trame-audience">Audience</Label>
            <select
              id="trame-audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value as typeof audience)}
              disabled={!canEdit}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:bg-muted disabled:cursor-default"
            >
              {AUDIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Editor + Variables */}
        <div className="flex gap-3 items-start">
          {/* Editor */}
          <div className="flex-1 space-y-1.5 min-w-0">
            <Label>Corps du message</Label>
            {canEdit ? (
              <div onFocus={() => { lastFocusedRef.current = "body"; }}>
                <TiptapEditor editor={editor} />
              </div>
            ) : (
              <div
                className="tiptap-editor rounded-md border bg-muted/30 text-sm px-3 py-2 min-h-[160px]"
                dangerouslySetInnerHTML={{ __html: template?.body ?? "" }}
              />
            )}
          </div>

          {/* Variable panel */}
          {canEdit && (
            <div className="w-48 shrink-0 space-y-1.5">
              <Label>Variables</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Rechercher…"
                  value={varSearch}
                  onChange={(e) => setVarSearch(e.target.value)}
                  className="w-full h-7 pl-6 pr-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="rounded-md border bg-background divide-y max-h-[280px] overflow-y-auto">
                {filteredVars.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className="flex flex-col w-full px-2 py-1.5 text-left hover:bg-accent transition-colors gap-0.5"
                  >
                    <span className="text-xs font-medium font-mono text-primary leading-tight">{`{{${v.key}}}`}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">ex : {v.example}</span>
                  </button>
                ))}
                {filteredVars.length === 0 && (
                  <p className="px-2 py-3 text-xs text-muted-foreground text-center">Aucune variable</p>
                )}
              </div>
            </div>
          )}
        </div>
      </SheetBody>

      <SheetFooter>
        {/* Left actions */}
        <div className="flex-1 flex items-center gap-2">
          {isEditing && canEdit && !isArchived && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={handleArchive}
                disabled={isPending}
              >
                <Archive className="h-3.5 w-3.5" />
                Archiver
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "gap-1.5",
                  template?.isDefaultCvNotification
                    ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                    : "text-muted-foreground"
                )}
                onClick={handleToggleDefault}
                disabled={isPending}
                title={template?.isDefaultCvNotification
                  ? "Retirer comme notification CV par défaut"
                  : "Définir comme notification CV par défaut"
                }
              >
                {template?.isDefaultCvNotification
                  ? <><BellOff className="h-3.5 w-3.5" /> Notif. CV active</>
                  : <><Bell className="h-3.5 w-3.5" /> Notif. CV</>
                }
              </Button>
            </>
          )}
          {isEditing && isAdmin && isArchived && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </Button>
          )}
        </div>

        {/* Right actions */}
        <Button variant="outline" onClick={onClose} disabled={isPending}>
          {canEdit ? "Annuler" : "Fermer"}
        </Button>
        {canEdit && (
          <Button onClick={handleSave} disabled={isPending || !name.trim() || !subject.trim()}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isEditing ? "Mettre à jour" : "Créer la trame"}
          </Button>
        )}
      </SheetFooter>
    </>
  );
}

// ─── Drawer shell ─────────────────────────────────────────────────────────────

export function TrameDrawer({
  open,
  onOpenChange,
  template,
  existingCategories,
  role,
  onSaved,
  onArchived,
  onDeleted,
  onDefaultToggled,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template: MailTemplateRow | null;
  existingCategories: string[];
  role: string;
  onSaved: (t: MailTemplateRow, isNew: boolean) => void;
  onArchived: (id: string) => void;
  onDeleted: (id: string) => void;
  onDefaultToggled: (id: string, isDefault: boolean) => void;
}) {
  const title = template
    ? CAN_EDIT_ROLES.has(role) ? "Modifier la trame" : "Voir la trame"
    : "Nouvelle trame";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-2xl flex flex-col p-0 gap-0">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetClose />
        </SheetHeader>

        {open && (
          <TrameForm
            key={template?.id ?? "new"}
            template={template}
            existingCategories={existingCategories}
            role={role}
            onSaved={onSaved}
            onArchived={onArchived}
            onDeleted={onDeleted}
            onDefaultToggled={onDefaultToggled}
            onClose={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createGlobalTask, searchEntities, type EntityResult } from "./actions";

type Profile = { id: string; fullName: string; email: string };

export type TaskCreatorAttachment = {
  entityType: "candidate" | "company";
  entityId: string;
  label: string;
  sub?: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  call: "Appel",
  email: "Email",
  document: "Document",
  follow_up: "Relance",
  interview: "Entretien",
  administrative: "Administratif",
  other: "Autre",
};

const TYPE_BADGE: Record<string, string> = {
  candidate: "bg-blue-50 text-blue-700",
  company: "bg-violet-50 text-violet-700",
  contact: "bg-amber-50 text-amber-700",
};

function tomorrowInput() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function attachmentKey(attachment: TaskCreatorAttachment) {
  return `${attachment.entityType}:${attachment.entityId}`;
}

function resultToAttachment(result: EntityResult): TaskCreatorAttachment {
  return {
    entityType: result.entityType,
    entityId: result.entityId,
    label: result.attachmentLabel,
    sub: result.type === "contact" ? `Via ${result.label}` : result.sub,
  };
}

export function CreateTaskModal({
  open,
  onClose,
  profiles,
  defaultAssignedTo,
  initialAttachments = [],
}: {
  open: boolean;
  onClose: () => void;
  profiles: Profile[];
  defaultAssignedTo: string;
  initialAttachments?: TaskCreatorAttachment[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntityResult[]>([]);
  const [selected, setSelected] = useState<TaskCreatorAttachment[]>(initialAttachments);
  const [searching, setSearching] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const initialKey = useMemo(
    () => initialAttachments.map(attachmentKey).join("|"),
    [initialAttachments]
  );

  useEffect(() => {
    if (!open) return;
    setSelected(initialAttachments);
    setQuery("");
    setResults([]);
    setError("");
  }, [open, initialKey]);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await searchEntities(query);
      setResults(res);
      setSearching(false);
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function handleSelect(entity: EntityResult) {
    const attachment = resultToAttachment(entity);
    setSelected((prev) => {
      if (prev.some((item) => attachmentKey(item) === attachmentKey(attachment))) return prev;
      return [...prev, attachment];
    });
    setQuery("");
    setResults([]);
    setError("");
  }

  function handleRemove(attachment: TaskCreatorAttachment) {
    setSelected((prev) => prev.filter((item) => attachmentKey(item) !== attachmentKey(attachment)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.length === 0) {
      setError("Ajoutez au moins un candidat ou une entreprise");
      return;
    }

    const fd = new FormData(formRef.current!);
    for (const attachment of selected) {
      fd.append(attachment.entityType === "candidate" ? "candidateIds" : "companyIds", attachment.entityId);
    }

    startTransition(async () => {
      const result = await createGlobalTask(fd);
      if (result?.error) {
        setError(result.error);
      } else {
        formRef.current?.reset();
        setSelected(initialAttachments);
        setQuery("");
        setResults([]);
        onClose();
      }
    });
  }

  function handleClose() {
    setSelected(initialAttachments);
    setQuery("");
    setResults([]);
    setError("");
    onClose();
  }

  return (
    <Modal open={open} onOpenChange={(nextOpen) => { if (!nextOpen) handleClose(); }}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle>Nouvelle tache</ModalTitle>
        </ModalHeader>
        <form
          key={`${initialKey}-${defaultAssignedTo}-${open ? "open" : "closed"}`}
          ref={formRef}
          onSubmit={handleSubmit}
        >
          <ModalBody className="space-y-4">
            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="space-y-1.5">
              <Label>Rattachements <span className="text-destructive">*</span></Label>

              {selected.length > 0 && (
                <div className="flex flex-wrap gap-2 rounded-md border bg-muted/20 p-2">
                  {selected.map((attachment) => (
                    <span
                      key={attachmentKey(attachment)}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs"
                    >
                      <span className={cn("rounded px-1.5 py-0.5 font-medium", TYPE_BADGE[attachment.entityType])}>
                        {attachment.entityType === "candidate" ? "Candidat" : "Entreprise"}
                      </span>
                      <span className="truncate">{attachment.label}</span>
                      <button type="button" onClick={() => handleRemove(attachment)} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-8"
                  placeholder="Rechercher un candidat, contact ou entreprise..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                />
                {(results.length > 0 || searching) && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-md border bg-popover shadow-md overflow-hidden">
                    {searching ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : results.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Aucun resultat</p>
                    ) : (
                      <ul>
                        {results.map((result, i) => (
                          <li key={`${result.type}-${result.entityId}-${i}`}>
                            <button
                              type="button"
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
                              onClick={() => handleSelect(result)}
                            >
                              <span className={cn("text-xs font-medium rounded px-1.5 py-0.5 shrink-0", TYPE_BADGE[result.type])}>
                                {result.type === "candidate" ? "Candidat" : result.type === "company" ? "Entreprise" : "Contact"}
                              </span>
                              <span className="flex-1 truncate">{result.label}</span>
                              <span className="text-xs text-muted-foreground truncate">{result.sub}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ct-title">Titre <span className="text-destructive">*</span></Label>
              <Input id="ct-title" name="title" placeholder="Ex: Appeler pour suivi dossier" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ct-category">Categorie</Label>
                <select
                  id="ct-category"
                  name="category"
                  defaultValue="follow_up"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ct-due">Echeance <span className="text-destructive">*</span></Label>
                <Input id="ct-due" name="dueAt" type="date" defaultValue={tomorrowInput()} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ct-assignee">Assigne a</Label>
              <select
                id="ct-assignee"
                name="assignedTo"
                defaultValue={defaultAssignedTo}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Non assigne</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.fullName || profile.email}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ct-description">Note</Label>
              <textarea
                id="ct-description"
                name="description"
                placeholder="Informations complementaires..."
                className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>Annuler</Button>
            <Button type="submit" disabled={isPending || selected.length === 0}>
              {isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Creation...</> : "Creer la tache"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

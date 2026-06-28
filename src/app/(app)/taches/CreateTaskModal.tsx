"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createGlobalTask, searchEntities, type EntityResult } from "./actions";

type Profile = { id: string; fullName: string; email: string };

const CATEGORY_LABELS: Record<string, string> = {
  call: "Appel", email: "Email", document: "Document",
  follow_up: "Relance", interview: "Entretien", other: "Autre",
};

const TYPE_BADGE: Record<string, string> = {
  candidate: "bg-blue-50 text-blue-700",
  company:   "bg-violet-50 text-violet-700",
  contact:   "bg-amber-50 text-amber-700",
};

export function CreateTaskModal({
  open,
  onClose,
  profiles,
}: {
  open: boolean;
  onClose: () => void;
  profiles: Profile[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntityResult[]>([]);
  const [selected, setSelected] = useState<EntityResult | null>(null);
  const [searching, setSearching] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    setSearching(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await searchEntities(query);
      setResults(res);
      setSearching(false);
    }, 300);
  }, [query]);

  function handleSelect(entity: EntityResult) {
    setSelected(entity);
    setQuery(entity.label);
    setResults([]);
  }

  function handleClearEntity() {
    setSelected(null);
    setQuery("");
    setResults([]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) { setError("Sélectionnez un rattachement"); return; }
    const fd = new FormData(formRef.current!);
    fd.set("candidateId", selected.candidateId ?? "");
    fd.set("companyId", selected.companyId ?? "");
    startTransition(async () => {
      const result = await createGlobalTask(fd);
      if (result?.error) {
        setError(result.error);
      } else {
        formRef.current?.reset();
        setSelected(null);
        setQuery("");
        onClose();
      }
    });
  }

  function handleClose() {
    setSelected(null);
    setQuery("");
    setResults([]);
    setError("");
    onClose();
  }

  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle>Nouvelle tâche</ModalTitle>
        </ModalHeader>
        <form ref={formRef} onSubmit={handleSubmit}>
          <ModalBody className="space-y-4">
            {error && <p className="text-xs text-destructive">{error}</p>}

            {/* Rattachement */}
            <div className="space-y-1.5">
              <Label>Rattachement <span className="text-destructive">*</span></Label>
              {selected ? (
                <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-muted/30">
                  <span className={cn("text-xs font-medium rounded px-1.5 py-0.5", TYPE_BADGE[selected.type])}>
                    {selected.type === "candidate" ? "Candidat" : selected.type === "company" ? "Entreprise" : "Contact"}
                  </span>
                  <span className="text-sm flex-1">{selected.label}</span>
                  <button type="button" onClick={handleClearEntity} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8"
                    placeholder="Rechercher un candidat, contact ou entreprise…"
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
                        <p className="px-3 py-2 text-sm text-muted-foreground">Aucun résultat</p>
                      ) : (
                        <ul>
                          {results.map((r, i) => (
                            <li key={i}>
                              <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
                                onClick={() => handleSelect(r)}
                              >
                                <span className={cn("text-xs font-medium rounded px-1.5 py-0.5 shrink-0", TYPE_BADGE[r.type])}>
                                  {r.type === "candidate" ? "Candidat" : r.type === "company" ? "Entreprise" : "Contact"}
                                </span>
                                <span className="flex-1">{r.label}</span>
                                <span className="text-xs text-muted-foreground">{r.sub}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Titre */}
            <div className="space-y-1.5">
              <Label htmlFor="ct-title">Titre <span className="text-destructive">*</span></Label>
              <Input id="ct-title" name="title" placeholder="Ex: Appeler pour suivi dossier" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Catégorie */}
              <div className="space-y-1.5">
                <Label htmlFor="ct-category">Catégorie</Label>
                <select
                  id="ct-category"
                  name="category"
                  defaultValue="follow_up"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              {/* Échéance */}
              <div className="space-y-1.5">
                <Label htmlFor="ct-due">Échéance <span className="text-destructive">*</span></Label>
                <Input id="ct-due" name="dueAt" type="date" required />
              </div>
            </div>

            {/* Assigné */}
            <div className="space-y-1.5">
              <Label htmlFor="ct-assignee">Assigné à</Label>
              <select
                id="ct-assignee"
                name="assignedTo"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Non assigné</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName || p.email}</option>
                ))}
              </select>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label htmlFor="ct-description">Note</Label>
              <textarea
                id="ct-description"
                name="description"
                placeholder="Informations complémentaires…"
                className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>Annuler</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Création…</> : "Créer la tâche"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

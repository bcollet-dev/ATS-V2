"use client";

import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { Mail, PlusCircle, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TrameDrawer } from "./TrameDrawer";
import { ParametrageTab } from "./ParametrageTab";
import type { MailTemplateRow } from "./actions";

// ─── Constants ────────────────────────────────────────────────────────────────

const AUDIENCE_LABEL: Record<string, string> = {
  candidate: "Candidat",
  company:   "Entreprise",
  all:       "Tous",
};

const AUDIENCE_STYLE: Record<string, string> = {
  candidate: "bg-blue-50 text-blue-700",
  company:   "bg-violet-50 text-violet-700",
  all:       "bg-muted text-muted-foreground",
};

const CAN_EDIT_ROLES = new Set(["admin", "team_leader", "admissions"]);

type Tab = "trames" | "parametrage";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TrameMailClient({
  initialTemplates,
  role,
  userId,
  userName,
  initialSigData,
  hasGmailConnected,
  gmailStatus,
}: {
  initialTemplates: MailTemplateRow[];
  role: string;
  userId: string;
  userName: string;
  initialSigData: import("./actions").SignatureData;
  hasGmailConnected: boolean;
  gmailStatus?: "connected" | "error" | "no_token";
}) {
  const [tab, setTab] = useState<Tab>("trames");
  const [templates, setTemplates] = useState<MailTemplateRow[]>(initialTemplates);
  const [showArchived, setShowArchived] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [audienceFilter, setAudienceFilter] = useState("");
  const [search, setSearch] = useState("");

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MailTemplateRow | null>(null);

  const canEdit = CAN_EDIT_ROLES.has(role);

  useEffect(() => {
    if (gmailStatus === "connected") toast.success("Compte Gmail connecté — envoi d'emails activé");
    if (gmailStatus === "error")     toast.error("Échec de la connexion Gmail — réessayez");
    if (gmailStatus === "no_token")  toast.error("Google n'a pas retourné de refresh token — réessayez en révoquant l'accès dans votre compte Google");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of templates) {
      if (t.category) set.add(t.category);
    }
    return Array.from(set).sort();
  }, [templates]);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (!showArchived && !t.active) return false;
      if (showArchived && t.active) return false;
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (audienceFilter && t.audience !== audienceFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!t.name.toLowerCase().includes(q) && !(t.category ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [templates, showArchived, categoryFilter, audienceFilter, search]);

  const activeCount = templates.filter((t) => t.active).length;
  const archivedCount = templates.filter((t) => !t.active).length;
  const hasFilters = !!(categoryFilter || audienceFilter || search.trim());

  function openNew() {
    setEditingTemplate(null);
    setDrawerOpen(true);
  }

  function openEdit(t: MailTemplateRow) {
    setEditingTemplate(t);
    setDrawerOpen(true);
  }

  function handleSaved(saved: MailTemplateRow, isNew: boolean) {
    setTemplates((prev) =>
      isNew ? [saved, ...prev] : prev.map((t) => (t.id === saved.id ? saved : t))
    );
  }

  function handleArchived(id: string) {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, active: false } : t))
    );
  }

  function handleDeleted(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  function handleDefaultToggled(id: string, isDefault: boolean) {
    setTemplates((prev) =>
      prev.map((t) => ({
        ...t,
        // Clear previous default when a new one is set
        isDefaultCvNotification: isDefault ? t.id === id : t.id === id ? false : t.isDefaultCvNotification,
      }))
    );
  }

  function clearFilters() {
    setCategoryFilter("");
    setAudienceFilter("");
    setSearch("");
  }

  return (
    <>
      <TrameDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        template={editingTemplate}
        existingCategories={categories}
        role={role}
        onSaved={handleSaved}
        onArchived={handleArchived}
        onDeleted={handleDeleted}
        onDefaultToggled={handleDefaultToggled}
      />

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Trames mail</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeCount} trame{activeCount !== 1 ? "s" : ""} active{activeCount !== 1 ? "s" : ""}
              {archivedCount > 0 && ` · ${archivedCount} archivée${archivedCount !== 1 ? "s" : ""}`}
            </p>
          </div>
          {canEdit && tab === "trames" && (
            <Button className="gap-1.5" onClick={openNew}>
              <PlusCircle className="h-4 w-4" />
              Nouvelle trame
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b">
          {(["trames", "parametrage"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                tab === t
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "trames" ? "Trames" : "Paramétrage"}
            </button>
          ))}
        </div>

        {/* Tab: Trames */}
        {tab === "trames" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Rechercher…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              {categories.length > 0 && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-8 px-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Toutes catégories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
              <select
                value={audienceFilter}
                onChange={(e) => setAudienceFilter(e.target.value)}
                className="h-8 px-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Toutes audiences</option>
                {Object.entries(AUDIENCE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <button
                onClick={() => setShowArchived((v) => !v)}
                className={cn(
                  "h-8 px-3 text-sm rounded-md border transition-colors",
                  showArchived
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-input text-muted-foreground hover:text-foreground"
                )}
              >
                {showArchived ? "Archivées" : "Actives"}
              </button>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 h-8 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                  Effacer
                </button>
              )}
            </div>

            {/* List */}
            {filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed p-12 text-center">
                <Mail className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">
                  {hasFilters
                    ? "Aucune trame ne correspond à ces filtres"
                    : showArchived
                    ? "Aucune trame archivée"
                    : "Aucune trame pour l'instant"}
                </p>
                {!hasFilters && !showArchived && canEdit && (
                  <Button variant="outline" className="mt-4 gap-1.5" onClick={openNew}>
                    <PlusCircle className="h-4 w-4" />
                    Nouvelle trame
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    canEdit={canEdit}
                    onEdit={() => openEdit(t)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Paramétrage */}
        {tab === "parametrage" && (
          <ParametrageTab
            userId={userId}
            userName={userName}
            initialSigData={initialSigData}
            hasGmailConnected={hasGmailConnected}
          />
        )}
      </div>
    </>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  canEdit,
  onEdit,
}: {
  template: MailTemplateRow;
  canEdit: boolean;
  onEdit: () => void;
}) {
  return (
    <div
      onClick={onEdit}
      className={cn(
        "flex items-start gap-4 rounded-lg border bg-card px-4 py-3 transition-all cursor-pointer hover:border-primary/40 hover:shadow-sm",
        !template.active && "opacity-60"
      )}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{template.name}</span>
          {template.isDefaultCvNotification && (
            <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs bg-blue-50 text-blue-700 font-medium">
              Notif. CV
            </span>
          )}
          {!template.active && (
            <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs bg-muted text-muted-foreground">
              Archivée
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{template.subject}</p>
        <div className="flex items-center gap-2 flex-wrap pt-0.5">
          {template.category && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-muted text-muted-foreground">
              {template.category}
            </span>
          )}
          <span className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            AUDIENCE_STYLE[template.audience]
          )}>
            {AUDIENCE_LABEL[template.audience]}
          </span>
        </div>
      </div>
      <div className="text-right shrink-0 space-y-1">
        <p className="text-xs text-muted-foreground">{fmtDate(template.updatedAt)}</p>
        {template.createdByName && (
          <p className="text-xs text-muted-foreground/70">{template.createdByName}</p>
        )}
        <span className="text-xs text-primary">
          {canEdit ? "Éditer →" : "Voir →"}
        </span>
      </div>
    </div>
  );
}

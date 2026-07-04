"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Mail, Phone, Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  addContact, updateContact, deleteContact,
  type CompanyContact, type ContactInput, type AlternantRow,
} from "./actions";

const EMPTY: ContactInput = {
  firstName: "", lastName: "", jobTitle: "", email: "", phone: "", isPrimary: false,
};

const BADGE: Record<AlternantRow["badge"], { label: string; className: string }> = {
  en_cours: { label: "En cours", className: "bg-emerald-100 text-emerald-700" },
  termine:  { label: "Terminé",  className: "bg-gray-200 text-gray-700" },
  rupture:  { label: "Rupture",  className: "bg-red-100 text-red-700" },
};

// ─── Contact Form ─────────────────────────────────────────────────────────────

function ContactForm({
  initial, onSave, onCancel, saving,
}: {
  initial: ContactInput;
  onSave: (data: ContactInput) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [v, setV] = useState(initial);
  const f = (field: keyof Omit<ContactInput, "isPrimary">) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setV((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="p-4 bg-muted/20 rounded-lg border space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Prénom *</Label>
          <Input className="h-8 text-sm" value={v.firstName} onChange={f("firstName")} autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Nom *</Label>
          <Input className="h-8 text-sm" value={v.lastName} onChange={f("lastName")} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Fonction</Label>
          <Input className="h-8 text-sm" value={v.jobTitle} onChange={f("jobTitle")} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Email</Label>
          <Input className="h-8 text-sm" type="email" value={v.email} onChange={f("email")} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Téléphone</Label>
          <Input className="h-8 text-sm" type="tel" value={v.phone} onChange={f("phone")} />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={v.isPrimary}
              onChange={(e) => setV((prev) => ({ ...prev, isPrimary: e.target.checked }))}
              className="h-3.5 w-3.5 rounded accent-primary"
            />
            Contact principal
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1 border-t">
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel} disabled={saving}>Annuler</Button>
        <Button
          type="button" size="sm" className="h-7 text-xs"
          disabled={saving || !v.firstName.trim() || !v.lastName.trim()}
          onClick={() => onSave(v)}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BlocPersonnel({
  companyId,
  initialContacts,
  alternants,
  canEdit,
}: {
  companyId: string;
  initialContacts: CompanyContact[];
  alternants: AlternantRow[];
  canEdit: boolean;
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  function handleAdd(data: ContactInput) {
    startSave(async () => {
      const result = await addContact(companyId, data);
      if (!result.success) { toast.error(result.error); return; }
      setContacts((prev) => {
        const base = data.isPrimary ? prev.map((c) => ({ ...c, isPrimary: false })) : prev;
        return [...base, {
          id: result.id,
          firstName: data.firstName.trim(), lastName: data.lastName.trim(),
          jobTitle: data.jobTitle.trim() || null, email: data.email.trim() || null,
          phone: data.phone.trim() || null, isPrimary: data.isPrimary,
        }];
      });
      setAdding(false);
      toast.success("Contact ajouté");
    });
  }

  function handleEdit(contactId: string, data: ContactInput) {
    startSave(async () => {
      const result = await updateContact(contactId, companyId, data);
      if (!result.success) { toast.error(result.error); return; }
      setContacts((prev) => {
        const base = data.isPrimary ? prev.map((c) => ({ ...c, isPrimary: false })) : prev;
        return base.map((c) => c.id === contactId ? {
          ...c, firstName: data.firstName.trim(), lastName: data.lastName.trim(),
          jobTitle: data.jobTitle.trim() || null, email: data.email.trim() || null,
          phone: data.phone.trim() || null, isPrimary: data.isPrimary,
        } : c);
      });
      setEditingId(null);
      toast.success("Contact mis à jour");
    });
  }

  function handleDelete(contactId: string) {
    startSave(async () => {
      await deleteContact(contactId, companyId);
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
      toast.success("Contact supprimé");
    });
  }

  return (
    <section className="rounded-lg border-2 border-primary/25 bg-card overflow-hidden shadow-sm">
      <div className="h-1 bg-primary/70" />
      <div className="flex items-center justify-between px-5 py-3.5 border-b bg-primary/[0.03]">
        <h2 className="text-sm font-semibold">Personnel</h2>
        {canEdit && (
          <Button
            variant="ghost" size="sm" className="gap-1.5 h-7 text-xs"
            onClick={() => { setAdding(true); setEditingId(null); }}
          >
            <Plus className="h-3.5 w-3.5" />Ajouter un contact
          </Button>
        )}
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* ── Contacts ── */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contacts</p>
          <div className="space-y-3">
            {contacts.length === 0 && !adding && (
              <p className="text-sm text-muted-foreground italic">Aucun contact</p>
            )}
            {contacts.map((contact) =>
              editingId === contact.id ? (
                <ContactForm
                  key={contact.id}
                  initial={{ firstName: contact.firstName, lastName: contact.lastName, jobTitle: contact.jobTitle ?? "", email: contact.email ?? "", phone: contact.phone ?? "", isPrimary: contact.isPrimary }}
                  onSave={(data) => handleEdit(contact.id, data)}
                  onCancel={() => setEditingId(null)}
                  saving={isSaving}
                />
              ) : (
                <div
                  key={contact.id}
                  className={cn(
                    "flex items-start gap-3 py-3 px-3 rounded-lg border",
                    contact.isPrimary && "border-primary/30 bg-primary/[0.03]"
                  )}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{contact.firstName} {contact.lastName}</span>
                      {contact.isPrimary && (
                        <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">Principal</span>
                      )}
                    </div>
                    {contact.jobTitle && <p className="text-xs text-muted-foreground">{contact.jobTitle}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      {contact.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{contact.email}</span>}
                      {contact.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{contact.phone}</span>}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onClick={() => { setEditingId(contact.id); setAdding(false); }} className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors" title="Modifier"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDelete(contact.id)} className="p-1.5 text-muted-foreground hover:text-red-600 rounded transition-colors" title="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </div>
              )
            )}
            {adding && (
              <ContactForm
                initial={EMPTY}
                onSave={handleAdd}
                onCancel={() => setAdding(false)}
                saving={isSaving}
              />
            )}
          </div>
        </div>

        {/* ── Alternants ── */}
        <div className="pt-2 border-t">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Alternants</p>
          {alternants.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Aucun alternant placé</p>
          ) : (
            <div className="space-y-2">
              {alternants.map((alt) => {
                const badge = BADGE[alt.badge];
                return (
                  <Link
                    key={alt.matchingId}
                    href={`/candidats/${alt.candidateId}`}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg border hover:bg-muted/40 transition-colors group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{alt.firstName} {alt.lastName}</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{alt.needTitle}</p>
                      {alt.endDate && (
                        <p className="text-xs text-muted-foreground">
                          Fin : {new Date(alt.endDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      )}
                    </div>
                    <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ml-3", badge.className)}>
                      {badge.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

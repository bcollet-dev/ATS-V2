"use client";

import { useState, useEffect, useRef } from "react";
import { Phone, Search, User, Building2 } from "lucide-react";
import { searchContacts, logCall, type ContactResult } from "../actions";
import { PostCallModal } from "../_components/PostCallModal";
import type { CallStatus } from "../_components/PostCallModal";

const PENDING_CALL_KEY = "eda_pending_call";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function SearchClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingContact, setPendingContact] = useState<ContactResult | null>(
    null,
  );
  const [showModal, setShowModal] = useState(false);
  const pendingRef = useRef<ContactResult | null>(null);

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    searchContacts(debouncedQuery)
      .then(setResults)
      .finally(() => setSearching(false));
  }, [debouncedQuery]);

  // Restore pending call from localStorage on mount (after page refresh)
  useEffect(() => {
    const stored = localStorage.getItem(PENDING_CALL_KEY);
    if (stored) {
      try {
        const contact = JSON.parse(stored) as ContactResult;
        pendingRef.current = contact;
        setPendingContact(contact);
        setShowModal(true);
      } catch {
        /* ignore */
      }
      localStorage.removeItem(PENDING_CALL_KEY);
    }
  }, []);

  // Show modal when returning from the phone dialer
  useEffect(() => {
    const handleReturn = () => {
      if (!document.hidden && pendingRef.current) {
        setShowModal(true);
      }
    };
    document.addEventListener("visibilitychange", handleReturn);
    window.addEventListener("focus", handleReturn);
    return () => {
      document.removeEventListener("visibilitychange", handleReturn);
      window.removeEventListener("focus", handleReturn);
    };
  }, []);

  const handleCallClick = (contact: ContactResult) => {
    pendingRef.current = contact;
    setPendingContact(contact);
    localStorage.setItem(PENDING_CALL_KEY, JSON.stringify(contact));
  };

  const handleModalClose = () => {
    setShowModal(false);
    setPendingContact(null);
    pendingRef.current = null;
    localStorage.removeItem(PENDING_CALL_KEY);
  };

  const handleModalSubmit = async (data: {
    status: CallStatus;
    note: string;
    relanceDate: string;
  }) => {
    if (!pendingContact) return;
    await logCall({
      contactId: pendingContact.id,
      contactType: pendingContact.type,
      companyId:
        pendingContact.type === "company_contact"
          ? pendingContact.companyId
          : undefined,
      contactName: `${pendingContact.firstName} ${pendingContact.lastName}`,
      callStatus: data.status,
      note: data.note || undefined,
      relanceDate: data.relanceDate || undefined,
    });
    handleModalClose();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 border-b border-gray-100 bg-white px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Nom, prénom…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-[var(--color-eda-orange)] focus:ring-2 focus:ring-[var(--color-eda-orange)]/20"
          />
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {query.length > 0 && query.length < 2 && (
          <p className="py-8 text-center text-sm text-gray-400">
            Tape au moins 2 caractères…
          </p>
        )}
        {searching && (
          <p className="py-8 text-center text-sm text-gray-400">
            Recherche…
          </p>
        )}
        {!searching && query.length >= 2 && results.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">
            Aucun résultat pour « {query} »
          </p>
        )}
        {results.map((contact) => (
          <ContactCard
            key={`${contact.type}-${contact.id}`}
            contact={contact}
            onCallClick={handleCallClick}
          />
        ))}
        {query.length === 0 && (
          <div className="flex flex-col items-center py-16 text-gray-300">
            <Search className="mb-3 h-12 w-12" />
            <p className="text-sm text-gray-400">
              Recherchez un candidat ou contact entreprise
            </p>
          </div>
        )}
      </div>

      {showModal && pendingContact && (
        <PostCallModal
          contactName={`${pendingContact.firstName} ${pendingContact.lastName}`}
          onClose={handleModalClose}
          onSubmit={handleModalSubmit}
        />
      )}
    </div>
  );
}

function ContactCard({
  contact,
  onCallClick,
}: {
  contact: ContactResult;
  onCallClick: (c: ContactResult) => void;
}) {
  const hasPhone = !!contact.phone;
  const name = `${contact.firstName} ${contact.lastName}`;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
        {contact.type === "candidate" ? (
          <User className="h-5 w-5 text-gray-500" />
        ) : (
          <Building2 className="h-5 w-5 text-gray-500" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-gray-900">{name}</p>
        {contact.type === "company_contact" && (
          <p className="truncate text-xs text-gray-500">{contact.companyName}</p>
        )}
        {contact.type === "candidate" && (
          <span className="inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
            Candidat
          </span>
        )}
        {contact.phone && (
          <p className="mt-0.5 text-xs text-gray-400">{contact.phone}</p>
        )}
      </div>

      {hasPhone ? (
        <a
          href={`tel:${contact.phone}`}
          onClick={() => onCallClick(contact)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-transform active:scale-90"
          style={{ backgroundColor: "var(--color-eda-orange)" }}
        >
          <Phone className="h-4 w-4" />
        </a>
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
          <Phone className="h-4 w-4 text-gray-300" />
        </div>
      )}
    </div>
  );
}

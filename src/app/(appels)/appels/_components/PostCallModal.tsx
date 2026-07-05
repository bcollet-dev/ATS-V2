"use client";

import { useState } from "react";
import { X, Phone, PhoneMissed, MessageSquare } from "lucide-react";

export type CallStatus = "answered" | "no_answer" | "voicemail";

interface PostCallModalProps {
  contactName: string;
  onClose: () => void;
  onSubmit: (data: {
    status: CallStatus;
    note: string;
    relanceDate: string;
  }) => Promise<void>;
}

const STATUS_OPTIONS: {
  value: CallStatus;
  label: string;
  icon: React.ElementType;
  activeClass: string;
}[] = [
  {
    value: "answered",
    label: "Décroché",
    icon: Phone,
    activeClass: "border-transparent bg-green-500 text-white",
  },
  {
    value: "no_answer",
    label: "Non décroché",
    icon: PhoneMissed,
    activeClass: "border-transparent bg-red-500 text-white",
  },
  {
    value: "voicemail",
    label: "Messagerie",
    icon: MessageSquare,
    activeClass: "border-transparent bg-yellow-500 text-white",
  },
];

export function PostCallModal({ contactName, onClose, onSubmit }: PostCallModalProps) {
  const [status, setStatus] = useState<CallStatus | null>(null);
  const [note, setNote] = useState("");
  const [relanceDate, setRelanceDate] = useState("");
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const handleSubmit = async () => {
    if (!status) return;
    setLoading(true);
    try {
      await onSubmit({ status, note, relanceDate });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Compte-rendu d&apos;appel
            </h2>
            <p className="text-sm text-gray-500">{contactName}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-2 text-sm font-medium text-gray-700">Résultat *</p>
        <div className="mb-4 flex gap-2">
          {STATUS_OPTIONS.map(({ value, label, icon: Icon, activeClass }) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border-2 py-3 text-xs font-medium transition-all ${
                status === value
                  ? activeClass
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <p className="mb-2 text-sm font-medium text-gray-700">
          Note <span className="font-normal text-gray-400">(optionnel)</span>
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Résumé de l'échange…"
          rows={3}
          className="mb-4 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[var(--color-eda-orange)] focus:ring-2 focus:ring-[var(--color-eda-orange)]/20"
        />

        <p className="mb-2 text-sm font-medium text-gray-700">
          Date de relance{" "}
          <span className="font-normal text-gray-400">(optionnel)</span>
        </p>
        <input
          type="date"
          value={relanceDate}
          onChange={(e) => setRelanceDate(e.target.value)}
          min={today}
          className="mb-5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[var(--color-eda-orange)] focus:ring-2 focus:ring-[var(--color-eda-orange)]/20"
        />

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!status || loading}
            className="flex-1 rounded-xl py-3 text-sm font-medium text-white transition-all active:scale-[0.98] disabled:opacity-40"
            style={{ backgroundColor: "var(--color-eda-orange)" }}
          >
            {loading ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

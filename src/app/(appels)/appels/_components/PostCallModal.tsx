"use client";

import { useState } from "react";
import {
  X,
  Phone,
  PhoneMissed,
  MessageSquare,
  CheckCircle2,
  Mail,
  FileText,
  Calendar,
  Clock,
  MoreHorizontal,
} from "lucide-react";
import type { ProfileOption } from "../actions";

export type CallStatus = "answered" | "no_answer" | "voicemail";

export type CallFormData = {
  status: CallStatus;
  note: string;
  relanceDate: string;
  relanceAssignedTo: string;
};

export type TaskFormData = {
  category: string;
  title: string;
  dueAt: string;
  assignedTo: string;
};

interface PostCallModalProps {
  contactName: string;
  currentUserId: string;
  profiles: ProfileOption[];
  onClose: () => void;
  onSubmitCall: (data: CallFormData) => Promise<void>;
  onSubmitTask: (data: TaskFormData) => Promise<void>;
}

const STATUS_OPTIONS = [
  { value: "answered" as CallStatus, label: "Décroché", icon: Phone, activeClass: "border-transparent bg-green-500 text-white" },
  { value: "no_answer" as CallStatus, label: "Non décroché", icon: PhoneMissed, activeClass: "border-transparent bg-red-500 text-white" },
  { value: "voicemail" as CallStatus, label: "Messagerie", icon: MessageSquare, activeClass: "border-transparent bg-yellow-500 text-white" },
];

const QUICK_CATEGORIES = [
  { value: "email", label: "Email", icon: Mail, defaultTitle: "Email" },
  { value: "document", label: "Documents", icon: FileText, defaultTitle: "Demande de documents" },
  { value: "interview", label: "Entretien", icon: Calendar, defaultTitle: "Entretien" },
  { value: "follow_up", label: "Relance", icon: Clock, defaultTitle: "Relance" },
  { value: "other", label: "Autre", icon: MoreHorizontal, defaultTitle: "Tâche" },
];

export function PostCallModal({
  contactName,
  currentUserId,
  profiles,
  onClose,
  onSubmitCall,
  onSubmitTask,
}: PostCallModalProps) {
  const [step, setStep] = useState<"call" | "task">("call");

  // Call step state
  const [status, setStatus] = useState<CallStatus | null>(null);
  const [note, setNote] = useState("");
  const [relanceDate, setRelanceDate] = useState("");
  const [relanceAssignedTo, setRelanceAssignedTo] = useState(currentUserId);
  const [callLoading, setCallLoading] = useState(false);

  // Task step state
  const [taskCategory, setTaskCategory] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [taskAssignedTo, setTaskAssignedTo] = useState(currentUserId);
  const [taskLoading, setTaskLoading] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  // ── Step 1: submit call ────────────────────────────────────────────────────

  const handleCallSubmit = async () => {
    if (!status) return;
    setCallLoading(true);
    try {
      await onSubmitCall({ status, note, relanceDate, relanceAssignedTo });
      setStep("task");
    } finally {
      setCallLoading(false);
    }
  };

  // ── Step 2: select category ────────────────────────────────────────────────

  const handleCategorySelect = (cat: (typeof QUICK_CATEGORIES)[number]) => {
    setTaskCategory(cat.value);
    setTaskTitle(`${cat.defaultTitle} — ${contactName}`);
    setTaskDueAt("");
    setTaskAssignedTo(currentUserId);
  };

  const handleTaskSubmit = async () => {
    if (!taskCategory || !taskDueAt) return;
    setTaskLoading(true);
    try {
      await onSubmitTask({
        category: taskCategory,
        title: taskTitle,
        dueAt: taskDueAt,
        assignedTo: taskAssignedTo,
      });
      onClose();
    } finally {
      setTaskLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-lg rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">

        {/* ── Step 1: Post-call form ─────────────────────────────────────── */}
        {step === "call" && (
          <div className="p-6">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Compte-rendu d&apos;appel</h2>
                <p className="text-sm text-gray-500">{contactName}</p>
              </div>
              <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Status */}
            <p className="mb-2 text-sm font-medium text-gray-700">Résultat *</p>
            <div className="mb-4 flex gap-2">
              {STATUS_OPTIONS.map(({ value, label, icon: Icon, activeClass }) => (
                <button
                  key={value}
                  onClick={() => setStatus(value)}
                  className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border-2 py-3 text-xs font-medium transition-all ${
                    status === value ? activeClass : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Note */}
            <p className="mb-2 text-sm font-medium text-gray-700">
              Note <span className="font-normal text-gray-400">(optionnel)</span>
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Résumé de l'échange…"
              rows={2}
              className="mb-4 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[var(--color-eda-orange)] focus:ring-2 focus:ring-[var(--color-eda-orange)]/20"
            />

            {/* Relance */}
            <p className="mb-2 text-sm font-medium text-gray-700">
              Relance <span className="font-normal text-gray-400">(optionnel)</span>
            </p>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <input
                type="date"
                value={relanceDate}
                onChange={(e) => setRelanceDate(e.target.value)}
                min={today}
                placeholder="Date"
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[var(--color-eda-orange)] focus:ring-2 focus:ring-[var(--color-eda-orange)]/20"
              />
              <select
                value={relanceAssignedTo}
                onChange={(e) => setRelanceAssignedTo(e.target.value)}
                disabled={!relanceDate}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[var(--color-eda-orange)] focus:ring-2 focus:ring-[var(--color-eda-orange)]/20 disabled:opacity-40"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id === currentUserId ? `Moi (${p.fullName})` : p.fullName}
                  </option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Annuler
              </button>
              <button
                onClick={handleCallSubmit}
                disabled={!status || callLoading}
                className="flex-1 rounded-xl py-3 text-sm font-medium text-white transition-all active:scale-[0.98] disabled:opacity-40"
                style={{ backgroundColor: "var(--color-eda-orange)" }}
              >
                {callLoading ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Create follow-up task ─────────────────────────────── */}
        {step === "task" && (
          <div className="p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Appel enregistré</p>
                <p className="text-xs text-gray-500">Créer une autre tâche ?</p>
              </div>
              <button onClick={onClose} className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Category picker */}
            <div className="mb-4 grid grid-cols-5 gap-1.5">
              {QUICK_CATEGORIES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => handleCategorySelect(QUICK_CATEGORIES.find((c) => c.value === value)!)}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 px-1 py-2.5 text-[10px] font-medium transition-all ${
                    taskCategory === value
                      ? "border-[var(--color-eda-orange)] bg-orange-50 text-[var(--color-eda-orange)]"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Task form — visible only after category is selected */}
            {taskCategory && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Titre de la tâche"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[var(--color-eda-orange)] focus:ring-2 focus:ring-[var(--color-eda-orange)]/20"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={taskDueAt}
                    onChange={(e) => setTaskDueAt(e.target.value)}
                    min={today}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[var(--color-eda-orange)] focus:ring-2 focus:ring-[var(--color-eda-orange)]/20"
                  />
                  <select
                    value={taskAssignedTo}
                    onChange={(e) => setTaskAssignedTo(e.target.value)}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[var(--color-eda-orange)] focus:ring-2 focus:ring-[var(--color-eda-orange)]/20"
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id === currentUserId ? `Moi (${p.fullName})` : p.fullName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-1">
                  <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50">
                    Non merci
                  </button>
                  <button
                    onClick={handleTaskSubmit}
                    disabled={!taskDueAt || !taskTitle || taskLoading}
                    className="flex-1 rounded-xl py-3 text-sm font-medium text-white transition-all active:scale-[0.98] disabled:opacity-40"
                    style={{ backgroundColor: "var(--color-eda-orange)" }}
                  >
                    {taskLoading ? "Création…" : "Créer la tâche"}
                  </button>
                </div>
              </div>
            )}

            {/* Skip if no category selected */}
            {!taskCategory && (
              <button onClick={onClose} className="w-full rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50">
                Non merci
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

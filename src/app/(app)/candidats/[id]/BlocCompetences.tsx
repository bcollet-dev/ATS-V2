"use client";

import { useState, useTransition, useRef, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { addSkill, deleteSkill } from "./skill-actions";

type Skill = { id: string; name: string };

export function BlocCompetences({
  candidateId,
  initialSkills,
  embedded,
}: {
  candidateId: string;
  initialSkills: Skill[];
  embedded?: boolean;
}) {
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [inputValue, setInputValue] = useState("");
  const [isAdding, startAdd] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function submitTag() {
    const name = inputValue.trim().replace(/,$/, "");
    if (!name) return;
    if (skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      setInputValue("");
      return;
    }
    const tempId = `temp-${Date.now()}`;
    setSkills((prev) => [...prev, { id: tempId, name }]);
    setInputValue("");
    startAdd(async () => {
      const result = await addSkill(candidateId, name);
      if (!result.success || !result.data) {
        setSkills((prev) => prev.filter((s) => s.id !== tempId));
        toast.error("Erreur lors de l'ajout");
        return;
      }
      const real = result.data;
      setSkills((prev) => prev.map((s) => (s.id === tempId ? real : s)));
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      submitTag();
    }
  }

  function handleDelete(skill: Skill) {
    setSkills((prev) => prev.filter((s) => s.id !== skill.id));
    let cancelled = false;
    const timerId = setTimeout(async () => {
      if (!cancelled) {
        const result = await deleteSkill(skill.id, candidateId);
        if (!result.success) {
          setSkills((prev) => [...prev, skill]);
          toast.error("Erreur lors de la suppression");
        }
      }
    }, 3500);
    toast(`"${skill.name}" supprimé`, {
      action: {
        label: "Annuler",
        onClick: () => { cancelled = true; clearTimeout(timerId); setSkills((prev) => [...prev, skill]); },
      },
      duration: 3500,
    });
  }

  const inner = (
    <>
      <div className={embedded
        ? "flex items-center px-5 py-3"
        : "px-5 py-3.5 border-b"
      }>
        {embedded
          ? <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Compétences</span>
          : <h2 className="text-sm font-semibold">Compétences</h2>
        }
      </div>
      <div className="px-5 py-4">
        <div className="flex flex-wrap gap-2 items-center">
          {skills.map((skill) => (
            <span
              key={skill.id}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary"
            >
              {skill.name}
              <button
                type="button"
                onClick={() => handleDelete(skill)}
                className="ml-0.5 text-primary/50 hover:text-primary transition-colors"
                aria-label={`Supprimer ${skill.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => { if (inputValue.trim()) submitTag(); }}
            placeholder="Ajouter…"
            disabled={isAdding}
            className="h-8 w-40 text-sm rounded-full border-dashed"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-3">Entrée ou virgule pour valider</p>
      </div>
    </>
  );

  if (embedded) return <div>{inner}</div>;
  return <section className="rounded-lg border bg-card">{inner}</section>;
}

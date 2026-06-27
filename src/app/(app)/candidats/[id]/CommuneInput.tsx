"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { searchCommune, type CommuneResult } from "./actions";

interface CommuneInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelectCommune: (nom: string, departement: string) => void;
}

export function CommuneInput({ value, onChange, onSelectCommune }: CommuneInputProps) {
  const [suggestions, setSuggestions] = useState<CommuneResult[]>([]);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleChange(v: string) {
    onChange(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (v.trim().length < 2) { setSuggestions([]); setOpen(false); return; }
    timerRef.current = setTimeout(() => {
      startTransition(async () => {
        const results = await searchCommune(v);
        setSuggestions(results);
        setOpen(results.length > 0);
      });
    }, 300);
  }

  function handleSelect(c: CommuneResult) {
    onSelectCommune(c.nom, c.departement);
    onChange(c.nom);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Ex : Lyon"
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          {suggestions.map((c) => (
            <button
              key={c.code}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(c); }}
              className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left"
            >
              <span>{c.nom}</span>
              <span className="text-xs text-muted-foreground ml-2">{c.departement} – {c.departementNom}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

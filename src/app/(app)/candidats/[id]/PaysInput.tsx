"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";

const PAYS = [
  "Afghanistan", "Afrique du Sud", "Albanie", "Algérie", "Allemagne", "Andorre",
  "Angola", "Arabie Saoudite", "Argentine", "Arménie", "Australie", "Autriche",
  "Azerbaïdjan", "Bangladesh", "Belgique", "Bénin", "Biélorussie", "Bolivie",
  "Bosnie-Herzégovine", "Brésil", "Bulgarie", "Burkina Faso", "Burundi",
  "Cambodge", "Cameroun", "Canada", "Cap-Vert", "Centrafrique", "Chili", "Chine",
  "Chypre", "Colombie", "Comores", "Congo", "Corée du Sud", "Côte d'Ivoire",
  "Croatie", "Cuba", "Danemark", "Djibouti", "Égypte", "Émirats Arabes Unis",
  "Équateur", "Érythrée", "Espagne", "Estonie", "États-Unis", "Éthiopie",
  "Finlande", "France", "Gabon", "Géorgie", "Ghana", "Grèce", "Guatemala",
  "Guinée", "Guinée-Bissau", "Guinée équatoriale", "Haïti", "Hongrie", "Inde",
  "Indonésie", "Irak", "Iran", "Irlande", "Islande", "Israël", "Italie",
  "Jamaïque", "Japon", "Jordanie", "Kazakhstan", "Kenya", "Kosovo", "Laos",
  "Lettonie", "Liban", "Libye", "Liechtenstein", "Lituanie", "Luxembourg",
  "Macédoine du Nord", "Madagascar", "Mali", "Malte", "Maroc", "Mauritanie",
  "Mexique", "Moldavie", "Monaco", "Mongolie", "Monténégro", "Mozambique",
  "Myanmar", "Namibie", "Népal", "Nicaragua", "Niger", "Nigéria", "Norvège",
  "Nouvelle-Zélande", "Ouganda", "Ouzbékistan", "Pakistan", "Palestine",
  "Panama", "Paraguay", "Pays-Bas", "Pérou", "Philippines", "Pologne",
  "Portugal", "République démocratique du Congo", "République dominicaine",
  "République tchèque", "Roumanie", "Royaume-Uni", "Russie", "Rwanda",
  "Sénégal", "Serbie", "Sierra Leone", "Slovaquie", "Slovénie", "Somalie",
  "Soudan", "Sri Lanka", "Suède", "Suisse", "Syrie", "Taïwan", "Tanzanie",
  "Tchad", "Thaïlande", "Togo", "Tunisie", "Turkménistan", "Turquie",
  "Ukraine", "Uruguay", "Venezuela", "Vietnam", "Yémen", "Zambie", "Zimbabwe",
];

interface PaysInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function PaysInput({ value, onChange }: PaysInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    const q = v.trim().toLowerCase();
    if (q.length < 1) { setSuggestions([]); setOpen(false); return; }
    const matches = PAYS.filter((p) => p.toLowerCase().startsWith(q)).slice(0, 8);
    setSuggestions(matches);
    setOpen(matches.length > 0);
  }

  function handleSelect(pays: string) {
    onChange(pays);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Ex : France"
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          {suggestions.map((pays) => (
            <button
              key={pays}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(pays); }}
              className="flex w-full px-3 py-2 text-sm hover:bg-accent text-left"
            >
              {pays}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

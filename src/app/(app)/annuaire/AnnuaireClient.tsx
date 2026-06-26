"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, Building2, BookUser, Phone, GraduationCap, MapPin, Hash, UserPlus, PlusCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { searchAnnuaire, type FilterType, type SearchResult } from "./actions";
import { CandidatDrawer } from "@/components/candidat-drawer";
import { EntrepriseDrawer } from "@/components/entreprise-drawer";

const FILTERS: { type: FilterType; label: string }[] = [
  { type: "candidat", label: "Candidats" },
  { type: "contact", label: "Contacts" },
  { type: "entreprise", label: "Entreprises" },
];

const TYPE_STYLES = {
  candidat: { badge: "bg-blue-100 text-blue-700", icon: Users },
  contact: { badge: "bg-purple-100 text-purple-700", icon: BookUser },
  entreprise: { badge: "bg-emerald-100 text-emerald-700", icon: Building2 },
} as const;

const TYPE_ROUTES = {
  candidat: "/candidats",
  contact: "/contacts",
  entreprise: "/entreprises",
} as const;

export function AnnuaireClient() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<FilterType[]>([
    "candidat",
    "contact",
    "entreprise",
  ]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const [hasSearched, setHasSearched] = useState(false);
  const [candidatDrawerOpen, setCandidatDrawerOpen] = useState(false);
  const [entrepriseDrawerOpen, setEntrepriseDrawerOpen] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    const timer = setTimeout(() => {
      setHasSearched(true);
      startTransition(async () => {
        const data = await searchAnnuaire(query, activeFilters);
        setResults(data);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, activeFilters]);

  function toggleFilter(type: FilterType) {
    setActiveFilters((prev) =>
      prev.includes(type)
        ? prev.length > 1 ? prev.filter((t) => t !== type) : prev
        : [...prev, type]
    );
  }

  function handleResultClick(result: SearchResult) {
    router.push(`${TYPE_ROUTES[result.type]}/${result.id}`);
  }

  return (
    <>
    <CandidatDrawer
      open={candidatDrawerOpen}
      onOpenChange={setCandidatDrawerOpen}
      onCreated={(id) => router.push(`/candidats/${id}`)}
    />
    <EntrepriseDrawer
      open={entrepriseDrawerOpen}
      onOpenChange={setEntrepriseDrawerOpen}
      onCreated={(id) => router.push(`/entreprises/${id}`)}
    />
    <div className="max-w-2xl mx-auto space-y-4">
      {/* En-tête avec boutons de création */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Annuaire</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCandidatDrawerOpen(true)}
            className="gap-1.5"
          >
            <UserPlus className="h-4 w-4" />
            Nouveau candidat
          </Button>
          <Button
            size="sm"
            onClick={() => setEntrepriseDrawerOpen(true)}
            className="gap-1.5"
          >
            <PlusCircle className="h-4 w-4" />
            Nouvelle entreprise
          </Button>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Rechercher un candidat, un contact ou une entreprise…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 h-11 text-base"
        />
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {FILTERS.map(({ type, label }) => {
          const active = activeFilters.includes(type);
          const { icon: Icon } = TYPE_STYLES[type];
          return (
            <button
              key={type}
              onClick={() => toggleFilter(type)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border transition-colors",
                active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/50"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Résultats */}
      <div className={cn("space-y-2 transition-opacity", isPending && "opacity-50")}>
        {hasSearched && results.length === 0 && !isPending && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucun résultat pour «&nbsp;{query}&nbsp;»
          </p>
        )}

        {results.map((result) => (
          <ResultCard
            key={`${result.type}-${result.id}`}
            result={result}
            onClick={() => handleResultClick(result)}
          />
        ))}
      </div>
    </div>
    </>
  );
}

function ResultCard({
  result,
  onClick,
}: {
  result: SearchResult;
  onClick: () => void;
}) {
  const { badge } = TYPE_STYLES[result.type];
  const typeLabel =
    result.type === "candidat"
      ? "Candidat"
      : result.type === "contact"
      ? "Contact"
      : "Entreprise";

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border bg-card px-4 py-3 hover:bg-accent/50 transition-colors flex items-start gap-3"
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">
            {result.type === "entreprise"
              ? result.name
              : `${result.firstName} ${result.lastName}`}
          </span>
          <Badge className={cn("text-xs font-medium px-1.5 py-0.5 rounded-md border-0", badge)}>
            {typeLabel}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {result.type === "candidat" && (
            <>
              {result.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {result.phone}
                </span>
              )}
              {result.cursusEnvisage && (
                <span className="flex items-center gap-1">
                  <GraduationCap className="h-3 w-3" />
                  {result.cursusEnvisage}
                </span>
              )}
            </>
          )}

          {result.type === "contact" && (
            <>
              {result.jobTitle && <span>{result.jobTitle}</span>}
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {result.companyName}
              </span>
              {result.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {result.phone}
                </span>
              )}
            </>
          )}

          {result.type === "entreprise" && (
            <>
              {result.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {result.city}
                </span>
              )}
              {result.siret && (
                <span className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  {result.siret}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </button>
  );
}

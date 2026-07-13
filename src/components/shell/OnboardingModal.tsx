"use client";

import { useState, useTransition } from "react";
import {
  LayoutDashboard, Users, Building2, GitMerge, BookOpen,
  ListTodo, RefreshCw, Mail, Zap, ChevronLeft, ChevronRight,
  X, Check, BarChart3, CalendarCheck, Bell, FileText,
  UserCheck, ClipboardList, Star, Sparkles, Search,
  PenLine, Phone, Calendar, AlertCircle, Plus,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import { markOnboardingComplete } from "@/app/(app)/onboarding/onboarding-actions";

type Slide = {
  id: string;
  icon: React.ElementType;
  color: string;
  title: string;
  subtitle: string;
  features: { icon: React.ElementType; label: string; desc: string }[];
};

const slides: Slide[] = [
  {
    id: "welcome",
    icon: Sparkles,
    color: "bg-[var(--color-eda-rh)]",
    title: "Bienvenue sur l'ATS EDA Groupe",
    subtitle: "Votre outil de recrutement centralisé — découvrez les fonctionnalités en 2 minutes.",
    features: [
      { icon: Users,       label: "Candidats & entreprises",   desc: "Tout vos contacts au même endroit" },
      { icon: GitMerge,    label: "Matching intelligent",       desc: "Proposez les bons candidats aux bons besoins" },
      { icon: ListTodo,    label: "Suivi des actions",          desc: "Tâches, relances, entretiens centralisés" },
      { icon: BarChart3,   label: "Pilotage en temps réel",     desc: "Dashboard et historique d'activité" },
    ],
  },
  {
    id: "dashboard",
    icon: LayoutDashboard,
    color: "bg-violet-500",
    title: "Dashboard",
    subtitle: "Vue d'ensemble de l'activité de recrutement en temps réel.",
    features: [
      { icon: BarChart3,     label: "Pipeline global",          desc: "Progression des candidats par étape" },
      { icon: CalendarCheck, label: "Tâches du jour",           desc: "Ce qui vous attend aujourd'hui" },
      { icon: Bell,          label: "Alertes & notifications",  desc: "Relances en retard, actions urgentes" },
      { icon: Star,          label: "Stats par recruteur",      desc: "Suivi de la performance individuelle" },
    ],
  },
  {
    id: "candidats",
    icon: Users,
    color: "bg-blue-500",
    title: "Candidats",
    subtitle: "Gérez chaque candidat de la première prise de contact jusqu'à la signature.",
    features: [
      { icon: UserCheck,   label: "Fiche complète",             desc: "Coordonnées, formation, situation actuelle" },
      { icon: FileText,    label: "Documents & CV",             desc: "Stockage et consultation centralisés" },
      { icon: GitMerge,    label: "Matchings associés",         desc: "Voir tous les besoins proposés" },
      { icon: PenLine,     label: "Notes & historique",         desc: "Traçabilité de tous les échanges" },
    ],
  },
  {
    id: "besoins",
    icon: Building2,
    color: "bg-emerald-500",
    title: "Besoins",
    subtitle: "Centralisez les offres d'alternance des entreprises partenaires.",
    features: [
      { icon: ClipboardList, label: "Fiche de poste",          desc: "Missions, contrat, rémunération, dates" },
      { icon: FileText,      label: "Génération FRE",          desc: "PDF prérempli en un clic depuis le besoin" },
      { icon: Zap,           label: "Push Ypareo",             desc: "Envoi du contrat directement dans Ypareo" },
      { icon: Users,         label: "Contacts entreprise",     desc: "Maître d'apprentissage et référent RH" },
    ],
  },
  {
    id: "matching",
    icon: GitMerge,
    color: "bg-orange-500",
    title: "Matching",
    subtitle: "Mettez en relation les candidats et les besoins, suivez chaque proposition.",
    features: [
      { icon: Search,        label: "Recherche croisée",       desc: "Filtrez candidats et besoins par critères" },
      { icon: GitMerge,      label: "Pipeline de validation",  desc: "Proposé → Entretien → FRE → Signé" },
      { icon: Star,          label: "Candidat favori",         desc: "Marquez le candidat retenu (winner)" },
      { icon: AlertCircle,   label: "Statuts bloquants",       desc: "Identifiez les étapes qui ralentissent" },
    ],
  },
  {
    id: "annuaire",
    icon: BookOpen,
    color: "bg-cyan-500",
    title: "Annuaire",
    subtitle: "Toutes vos entreprises partenaires et leurs contacts en un endroit.",
    features: [
      { icon: Building2,   label: "Fiche entreprise",          desc: "SIRET, NAF, OPCO, convention collective" },
      { icon: Users,       label: "Contacts RH",               desc: "Interlocuteurs par entreprise" },
      { icon: Phone,       label: "PWA Appels",                desc: "Appelez et loggez depuis votre mobile" },
      { icon: PenLine,     label: "Notes entreprise",          desc: "Contexte et historique des échanges" },
    ],
  },
  {
    id: "taches",
    icon: ListTodo,
    color: "bg-rose-500",
    title: "Tâches",
    subtitle: "Centralisez toutes vos actions de suivi, ne laissez rien passer.",
    features: [
      { icon: Phone,       label: "Appels & relances",         desc: "NRP, À rappeler, Décroché — depuis la PWA" },
      { icon: Mail,        label: "Emails",                    desc: "Tâches email liées à un candidat ou contact" },
      { icon: Calendar,    label: "Entretiens",                desc: "Planifiez et suivez les entretiens" },
      { icon: Plus,        label: "Création rapide",           desc: "Bouton flottant disponible partout dans l'ATS" },
    ],
  },
  {
    id: "cursus-trames",
    icon: RefreshCw,
    color: "bg-amber-500",
    title: "Cursus & Trames mail",
    subtitle: "Référentiels et templates pour aller plus vite au quotidien.",
    features: [
      { icon: RefreshCw,   label: "Cursus Ypareo",             desc: "Référentiel des formations synchronisé" },
      { icon: Mail,        label: "Trames mail",               desc: "Templates prêts à l'emploi avec variables" },
      { icon: PenLine,     label: "19 variables dynamiques",   desc: "Nom, poste, dates — auto-remplis au contexte" },
      { icon: UserCheck,   label: "Signature personnalisée",   desc: "Photo, titre, coordonnées dans chaque email" },
    ],
  },
  {
    id: "tips",
    icon: Zap,
    color: "bg-[var(--color-eda-rh)]",
    title: "Raccourcis à retenir",
    subtitle: "Quelques astuces pour être encore plus efficace.",
    features: [
      { icon: Plus,        label: "Bouton + flottant",         desc: "Créez une tâche depuis n'importe quelle page" },
      { icon: Bell,        label: "Cloche de notifications",   desc: "Alertes en temps réel pour votre équipe" },
      { icon: Zap,         label: "Ce guide",                  desc: "Accessible à tout moment via le bouton ? du menu" },
      { icon: Check,       label: "C'est parti !",             desc: "Vous êtes prêt — bonne utilisation" },
    ],
  },
];

export function OnboardingModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(0);
  const [, startTransition] = useTransition();

  if (!open) return null;

  const slide = slides[current];
  const isFirst = current === 0;
  const isLast = current === slides.length - 1;
  const Icon = slide.icon;

  function handleClose() {
    startTransition(async () => {
      await markOnboardingComplete();
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-background shadow-2xl overflow-hidden">

        {/* Header coloré */}
        <div className={`${slide.color} px-6 pt-6 pb-8 text-white`}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
              <Icon className="h-6 w-6" />
            </div>
            <button
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <h2 className="text-xl font-bold leading-tight">{slide.title}</h2>
          <p className="mt-1.5 text-sm text-white/80 leading-relaxed">{slide.subtitle}</p>
        </div>

        {/* Features */}
        <div className="px-6 py-5 space-y-3">
          {slide.features.map(({ icon: FIcon, label, desc }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <FIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Lien vers les guides détaillés par workflow */}
        <div className="px-6 pb-1">
          <Link
            href={"/guide" as Route}
            onClick={handleClose}
            className="flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Voir les guides détaillés par workflow
          </Link>
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between px-6 pb-6 pt-2">
          {/* Dots */}
          <div className="flex gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === current ? "w-5 bg-foreground" : "w-1.5 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          {/* Prev / Next */}
          <div className="flex gap-2">
            {!isFirst && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrent((c) => c - 1)}
                className="h-9 gap-1 px-3"
              >
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={handleClose} className="h-9 gap-1 px-4">
                <Check className="h-4 w-4" />
                Commencer
              </Button>
            ) : (
              <Button size="sm" onClick={() => setCurrent((c) => c + 1)} className="h-9 gap-1 px-3">
                Suivant
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

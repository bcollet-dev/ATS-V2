import {
  LayoutDashboard,
  Users,
  Building2,
  GitMerge,
  BookOpen,
  History,
  ListTodo,
  Mail,
  Settings,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

export const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Candidats",
    href: "/candidats",
    icon: Users,
  },
  {
    label: "Besoins",
    href: "/besoins",
    icon: Building2,
  },
  {
    label: "Matching",
    href: "/matching",
    icon: GitMerge,
  },
  {
    label: "Annuaire",
    href: "/annuaire",
    icon: BookOpen,
  },
  {
    label: "Tâches",
    href: "/taches",
    icon: ListTodo,
  },
  {
    label: "Cursus",
    href: "/cursus",
    icon: RefreshCw,
  },
  {
    label: "Trames mail",
    href: "/trames-mail",
    icon: Mail,
  },
] as const;

export const adminNavItems = [
  {
    label: "Historique",
    href: "/historique",
    icon: History,
  },
  {
    label: "Utilisateurs",
    href: "/utilisateurs",
    icon: Settings,
  },
  {
    label: "Erreurs",
    href: "/erreurs",
    icon: AlertCircle,
  },
] as const;

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: string;
}

export const platformNavigation: NavigationItem[] = [
  {
    id: "mission-control",
    label: "Mission Control",
    href: "/",
    icon: "🏠",
  },
  {
    id: "my-channel",
    label: "Mi canal",
    href: "/channel",
    icon: "📺",
  },
  {
    id: "competitors",
    label: "Competidores",
    href: "/competitors",
    icon: "🎯",
  },
  {
    id: "ai-strategy",
    label: "Estrategia IA",
    href: "/strategy",
    icon: "🧠",
  },
  {
    id: "viral-ideas",
    label: "Ideas virales",
    href: "/ideas",
    icon: "🚀",
  },
  {
    id: "analytics",
    label: "Analíticas",
    href: "/analytics",
    icon: "📊",
  },
  {
    id: "settings",
    label: "Configuración",
    href: "/settings",
    icon: "⚙️",
  },
];
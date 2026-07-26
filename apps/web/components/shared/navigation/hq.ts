import type { NavigationItem } from "./platform";

export const hqNavigation: NavigationItem[] = [
  {
    id: "hq-dashboard",
    label: "Dashboard",
    href: "/hq",
    icon: "⌂",
  },
  {
    id: "constitution",
    label: "Constitución",
    href: "/hq/constitution",
    icon: "§",
  },
  {
    id: "blueprint",
    label: "Master Blueprint",
    href: "/hq/blueprint",
    icon: "◇",
  },
  {
    id: "csi",
    label: "CSI",
    href: "/hq/csi",
    icon: "◉",
  },
  {
    id: "backlog",
    label: "Backlog",
    href: "/hq/backlog",
    icon: "☷",
  },
  {
    id: "roadmap",
    label: "Roadmap",
    href: "/hq/roadmap",
    icon: "↗",
  },
  {
    id: "business-strategy",
    label: "Business Strategy",
    href: "/hq/business-strategy",
    icon: "◆",
  },
];
import type { DocumentCategory } from "../types/hq";

export interface HqNavigationItem {
  id: DocumentCategory | "hq";
  label: string;
  description: string;
  href: string;
}

export const hqNavigationItems: HqNavigationItem[] = [
  {
    id: "hq",
    label: "CreatorOS HQ",
    description: "Centro estratégico y documental de CreatorOS.",
    href: "/hq",
  },
  {
    id: "constitution",
    label: "Constitución",
    description: "Misión, visión y principios fundamentales.",
    href: "/hq/constitution",
  },
  {
    id: "blueprint",
    label: "Master Blueprint",
    description: "Arquitectura, motores, módulos y roadmap técnico.",
    href: "/hq/blueprint",
  },
  {
    id: "csi",
    label: "CSI Knowledge Base",
    description: "Investigaciones, oportunidades, riesgos y decisiones.",
    href: "/hq/csi",
  },
  {
    id: "backlog",
    label: "Product Backlog",
    description: "Funcionalidades priorizadas y criterios de desarrollo.",
    href: "/hq/backlog",
  },
  {
    id: "roadmap",
    label: "Roadmap",
    description: "Evolución planificada de CreatorOS.",
    href: "/hq/roadmap",
  },
  {
    id: "business-strategy",
    label: "Business Strategy",
    description: "Modelo de negocio, pricing, crecimiento y proyecciones.",
    href: "/hq/business-strategy",
  },
];

export function getLocalizedHqHref(locale: string, href: string): string {
  return `/${locale}${href}`;
}
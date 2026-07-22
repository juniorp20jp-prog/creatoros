import type { BlueprintModuleDefinition } from "./types";

export const blueprintModules = [
  { id: "aiBrain", category: "intelligence", route: "ai-brain", glyph: "AI", availability: "planned" },
  { id: "creatorIntelligence", category: "intelligence", route: "creator-intelligence", glyph: "CI", availability: "available" },
  { id: "promptStudio", category: "intelligence", route: "prompt-studio", glyph: "PS", availability: "planned" },
  { id: "researchCenter", category: "intelligence", route: "research-center", glyph: "RC", availability: "planned" },
  { id: "youtubeAnalyzer", category: "analysis", route: "youtube-analyzer", glyph: "YT", availability: "available" },
  { id: "competitorAnalyzer", category: "analysis", route: "competitor-analyzer", glyph: "CA", availability: "planned" },
  { id: "analytics", category: "analysis", route: "analytics", glyph: "AN", availability: "planned" },
  { id: "viralContentLab", category: "creation", route: "viral-content-lab", glyph: "VL", availability: "planned" },
  { id: "scriptGenerator", category: "creation", route: "script-generator", glyph: "SG", availability: "planned" },
  { id: "thumbnailStudio", category: "creation", route: "thumbnail-studio", glyph: "TS", availability: "planned" },
  { id: "seoEngine", category: "creation", route: "seo-engine", glyph: "SE", availability: "planned" },
  { id: "contentPlanner", category: "operations", route: "content-planner", glyph: "CP", availability: "planned" },
  { id: "automationCenter", category: "operations", route: "automation-center", glyph: "AC", availability: "planned" },
  { id: "creatorProfile", category: "system", route: "creator-profile", glyph: "CR", availability: "planned" },
  { id: "settings", category: "system", route: "settings", glyph: "ST", availability: "planned" },
] satisfies ReadonlyArray<BlueprintModuleDefinition>;

export const moduleCategories = [
  "intelligence",
  "analysis",
  "creation",
  "operations",
  "system",
] as const;

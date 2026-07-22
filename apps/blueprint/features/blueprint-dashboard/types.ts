import type { Dictionary } from "../../i18n/dictionaries";

export type BlueprintDictionary = Dictionary["blueprint"];

export type DashboardMetricId =
  | "projectStatus"
  | "currentSprint"
  | "nextTasks"
  | "recentActivity"
  | "aiEngines"
  | "implementedModules";

export type TaskId =
  | "dashboardFoundation"
  | "moduleRegistry"
  | "navigationContract";

export type ActivityId =
  | "buildValidated"
  | "architectureApproved"
  | "sprintStarted";

export type StatusTone =
  | "brand"
  | "success"
  | "warning"
  | "neutral";

export type DashboardData = {
  version: string;
  progress: number;
  metrics: ReadonlyArray<{
    id: DashboardMetricId;
    tone: StatusTone;
  }>;
  tasks: ReadonlyArray<{
    id: TaskId;
    status: "inProgress" | "next";
  }>;
  activity: ReadonlyArray<{
    id: ActivityId;
    tone: StatusTone;
  }>;
};

export type ModuleCategory =
  | "intelligence"
  | "analysis"
  | "creation"
  | "operations"
  | "system";

export type BlueprintModuleId =
  | "aiBrain"
  | "creatorIntelligence"
  | "youtubeAnalyzer"
  | "competitorAnalyzer"
  | "viralContentLab"
  | "scriptGenerator"
  | "thumbnailStudio"
  | "seoEngine"
  | "promptStudio"
  | "contentPlanner"
  | "researchCenter"
  | "automationCenter"
  | "analytics"
  | "creatorProfile"
  | "settings";

export type BlueprintModuleDefinition = {
  id: BlueprintModuleId;
  category: ModuleCategory;
  route: string;
  glyph: string;
  availability: "planned" | "available";
};

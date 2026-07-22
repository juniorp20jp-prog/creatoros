import type { DashboardData } from "./types";

export const BLUEPRINT_VERSION = "0.2.0-alpha";

export const dashboardData = {
  version: BLUEPRINT_VERSION,
  progress: 18,
  metrics: [
    { id: "projectStatus", tone: "success" },
    { id: "currentSprint", tone: "brand" },
    { id: "nextTasks", tone: "warning" },
    { id: "recentActivity", tone: "neutral" },
    { id: "aiEngines", tone: "brand" },
    { id: "implementedModules", tone: "success" },
  ],
  tasks: [
    { id: "dashboardFoundation", status: "inProgress" },
    { id: "moduleRegistry", status: "inProgress" },
    { id: "navigationContract", status: "next" },
  ],
  activity: [
    { id: "buildValidated", tone: "success" },
    { id: "architectureApproved", tone: "brand" },
    { id: "sprintStarted", tone: "neutral" },
  ],
} satisfies DashboardData;

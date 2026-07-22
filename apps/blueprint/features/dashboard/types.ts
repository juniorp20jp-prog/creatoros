export type DashboardMetric = {
  id: string;
  label: string;
  value: string;
  detail: string;
};

export type DashboardAction = {
  id: string;
  step: string;
  title: string;
  description: string;
  featured?: boolean;
};

export type DashboardHeroContent = {
  heroLabel: string;
  headline: string;
  description: string;
  createMissionLabel: string;
  explorePlatformLabel: string;
  activeMissionLabel: string;
  notConfiguredLabel: string;
  progressLabel: string;
  probabilityLabel: string;
  estimatedDateLabel: string;
};

export type DashboardSectionContent = {
  guidedSetupLabel: string;
  nextActionsLabel: string;
  completedCountLabel: string;
  startLabel: string;
};
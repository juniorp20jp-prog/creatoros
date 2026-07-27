import type { AnalysisRunStatus } from "./analysis-run-model";

export const ANALYSIS_RUN_TRANSITIONS: Readonly<
  Record<AnalysisRunStatus, ReadonlyArray<AnalysisRunStatus>>
> = {
  pending: ["processing"],
  processing: ["completed", "failed"],
  completed: [],
  failed: [],
};

export function canTransitionAnalysisRun(
  current: AnalysisRunStatus,
  target: AnalysisRunStatus,
): boolean {
  return ANALYSIS_RUN_TRANSITIONS[current].includes(target);
}

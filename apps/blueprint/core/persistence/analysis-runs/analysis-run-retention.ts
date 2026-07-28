import type { AnalysisRun } from "./analysis-run-model";

export type AnalysisRunRetentionPolicy =
  | {
      kind: "keep-forever";
      protectedAnalysisRunIds?: ReadonlyArray<string>;
    }
  | {
      kind: "max-runs-per-channel";
      maxRuns: number;
      protectedAnalysisRunIds?: ReadonlyArray<string>;
    }
  | {
      kind: "max-age";
      maxAgeDays: number;
      protectedAnalysisRunIds?: ReadonlyArray<string>;
    };

export type RetentionDecisionReason =
  | "keep-forever"
  | "protected-run"
  | "within-channel-limit"
  | "channel-limit-exceeded"
  | "within-max-age"
  | "max-age-exceeded";

export type RetentionPlanEntry = {
  analysisRunId: string;
  channelId: string;
  createdAt: string;
  reason: RetentionDecisionReason;
};

export type RetentionPlan = {
  evaluatedAt: string;
  dryRun: boolean;
  policy: AnalysisRunRetentionPolicy;
  kept: ReadonlyArray<RetentionPlanEntry>;
  deletionCandidates: ReadonlyArray<RetentionPlanEntry>;
};

export type RetentionPlanningError = {
  code: "invalid-policy" | "invalid-run";
  message: string;
  analysisRunId?: string;
};

export type RetentionPlanningResult =
  | {
      status: "success";
      plan: RetentionPlan;
    }
  | {
      status: "failure";
      error: RetentionPlanningError;
    };

const MILLISECONDS_PER_DAY = 86_400_000;

function isCanonicalTimestamp(value: string): boolean {
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString() === value
  );
}

function compareRuns(left: AnalysisRun, right: AnalysisRun): number {
  return (
    left.channelId.localeCompare(right.channelId) ||
    right.createdAt.localeCompare(left.createdAt) ||
    left.analysisRunId.localeCompare(right.analysisRunId)
  );
}

function entry(
  run: AnalysisRun,
  reason: RetentionDecisionReason,
): RetentionPlanEntry {
  return {
    analysisRunId: run.analysisRunId,
    channelId: run.channelId,
    createdAt: run.createdAt,
    reason,
  };
}

function validatePolicy(
  policy: AnalysisRunRetentionPolicy,
): RetentionPlanningError | undefined {
  const protectedIds = policy.protectedAnalysisRunIds ?? [];
  if (
    protectedIds.some((id) => id.trim().length === 0) ||
    new Set(protectedIds).size !== protectedIds.length
  ) {
    return {
      code: "invalid-policy",
      message:
        "Protected analysis run identifiers must be non-empty and unique.",
    };
  }

  if (
    policy.kind === "max-runs-per-channel" &&
    (!Number.isInteger(policy.maxRuns) || policy.maxRuns < 1)
  ) {
    return {
      code: "invalid-policy",
      message: "maxRuns must be a positive integer.",
    };
  }

  if (
    policy.kind === "max-age" &&
    (!Number.isInteger(policy.maxAgeDays) ||
      policy.maxAgeDays < 1)
  ) {
    return {
      code: "invalid-policy",
      message: "maxAgeDays must be a positive integer.",
    };
  }

  return undefined;
}

export function planAnalysisRunRetention(
  runs: ReadonlyArray<AnalysisRun>,
  policy: AnalysisRunRetentionPolicy,
  options: {
    evaluatedAt: string;
    dryRun: boolean;
  },
): RetentionPlanningResult {
  const policyError = validatePolicy(policy);
  if (policyError) {
    return { status: "failure", error: policyError };
  }

  if (!isCanonicalTimestamp(options.evaluatedAt)) {
    return {
      status: "failure",
      error: {
        code: "invalid-policy",
        message: "evaluatedAt must be canonical UTC ISO 8601.",
      },
    };
  }

  const ids = new Set<string>();
  for (const run of runs) {
    if (
      run.analysisRunId.trim().length === 0 ||
      run.channelId.trim().length === 0 ||
      !isCanonicalTimestamp(run.createdAt) ||
      ids.has(run.analysisRunId)
    ) {
      return {
        status: "failure",
        error: {
          code: "invalid-run",
          message:
            "Retention input contains an invalid or duplicate analysis run.",
          analysisRunId: run.analysisRunId,
        },
      };
    }
    ids.add(run.analysisRunId);
  }

  const protectedIds = new Set(
    policy.protectedAnalysisRunIds ?? [],
  );
  const kept: RetentionPlanEntry[] = [];
  const deletionCandidates: RetentionPlanEntry[] = [];
  const ordered = [...runs].sort(compareRuns);
  const unprotectedChannelCounts = new Map<string, number>();
  const cutoff =
    policy.kind === "max-age"
      ? Date.parse(options.evaluatedAt) -
        policy.maxAgeDays * MILLISECONDS_PER_DAY
      : undefined;

  for (const run of ordered) {
    if (protectedIds.has(run.analysisRunId)) {
      kept.push(entry(run, "protected-run"));
      continue;
    }

    if (policy.kind === "keep-forever") {
      kept.push(entry(run, "keep-forever"));
      continue;
    }

    if (policy.kind === "max-runs-per-channel") {
      const current =
        unprotectedChannelCounts.get(run.channelId) ?? 0;
      unprotectedChannelCounts.set(run.channelId, current + 1);
      if (current < policy.maxRuns) {
        kept.push(entry(run, "within-channel-limit"));
      } else {
        deletionCandidates.push(
          entry(run, "channel-limit-exceeded"),
        );
      }
      continue;
    }

    if (Date.parse(run.createdAt) < (cutoff ?? Number.MIN_SAFE_INTEGER)) {
      deletionCandidates.push(entry(run, "max-age-exceeded"));
    } else {
      kept.push(entry(run, "within-max-age"));
    }
  }

  return {
    status: "success",
    plan: {
      evaluatedAt: options.evaluatedAt,
      dryRun: options.dryRun,
      policy: structuredClone(policy),
      kept,
      deletionCandidates,
    },
  };
}

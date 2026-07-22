import type {
  EngineError,
  EngineExecutionContext,
  EngineExecutionMetadata,
  EngineExecutionResult,
} from "../types/engine";

type ResultDetails = {
  providerIds?: ReadonlyArray<string>;
  completedStepIds?: ReadonlyArray<string>;
};

function createMetadata(
  context: EngineExecutionContext,
  details: ResultDetails,
): EngineExecutionMetadata {
  return {
    executionId: context.executionId,
    engineId: context.engineId,
    startedAt: context.startedAt,
    finishedAt: context.now(),
    providerIds: details.providerIds ?? [],
    completedStepIds: details.completedStepIds ?? [],
  };
}

export function completeExecution<TOutput>(
  context: EngineExecutionContext,
  output: TOutput,
  details: ResultDetails = {},
): EngineExecutionResult<TOutput> {
  return {
    status: "completed",
    output,
    metadata: createMetadata(context, details),
  };
}

export function failExecution<TOutput>(
  context: EngineExecutionContext,
  error: EngineError,
  details: ResultDetails = {},
): EngineExecutionResult<TOutput> {
  return {
    status: "failed",
    error,
    metadata: createMetadata(context, details),
  };
}

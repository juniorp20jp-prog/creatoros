export type EngineDefinition<TId extends string = string> = {
  id: TId;
  name: string;
  version: string;
  capabilities: ReadonlyArray<string>;
};

export type EngineExecutionContext = {
  executionId: string;
  engineId: string;
  startedAt: string;
  locale?: string;
  correlationId?: string;
  attributes: Readonly<Record<string, string>>;
  now: () => string;
};

export type EngineExecutionMetadata = {
  executionId: string;
  engineId: string;
  startedAt: string;
  finishedAt: string;
  providerIds: ReadonlyArray<string>;
  completedStepIds: ReadonlyArray<string>;
};

export type EngineError = {
  code: string;
  message: string;
  retryable: boolean;
};

export type EngineExecutionResult<TOutput> =
  | {
      status: "completed";
      output: TOutput;
      metadata: EngineExecutionMetadata;
    }
  | {
      status: "failed";
      error: EngineError;
      metadata: EngineExecutionMetadata;
    };

export type EngineContract = {
  input: unknown;
  output: unknown;
};

export type EngineContractsConstraint<TContracts> = {
  [TKey in keyof TContracts]: EngineContract;
};

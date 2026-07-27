import type {
  ChannelDataAdapter,
  ChannelDataAdapterResult,
} from "../../adapters";
import {
  CREATOR_ANALYSIS_PIPELINE_VERSION,
  CreatorIntelligenceAnalysisPipeline,
} from "../../engines";
import {
  SystemClock,
  UuidGenerator,
  type Clock,
  type IdGenerator,
} from "../../services";
import type {
  AnalysisRun,
  AnalysisRunFailureStage,
} from "./analysis-run-model";
import { ANALYSIS_RUN_SCHEMA_VERSION } from "./analysis-run-model";
import type { AnalysisRunRepository } from "./analysis-run-repository";
import type {
  AnalysisRunRepositoryError,
} from "./analysis-run-repository-error";

export type ExecutePersistedAnalysisInput<TSource> = {
  sourceData: TSource;
  creatorId: string;
  channelId: string;
  analysisRunId?: string;
  correlationId?: string;
  sourceReference?: string;
  attempt?: number;
  retryOfAnalysisRunId?: string;
};

export type PersistedAnalysisExecutionError = {
  code: string;
  message: string;
};

export type PersistedAnalysisExecutionResult =
  | {
      status: "completed";
      analysisRunId: string;
      adapterStatus: "success" | "partial";
      run: AnalysisRun;
    }
  | {
      status: "failed";
      stage: AnalysisRunFailureStage;
      analysisRunId: string;
      error: PersistedAnalysisExecutionError;
      run?: AnalysisRun;
    };

export class AnalysisRunOrchestrator<TSource> {
  constructor(
    private readonly adapter: ChannelDataAdapter<TSource>,
    private readonly repository: AnalysisRunRepository,
    private readonly pipeline =
      new CreatorIntelligenceAnalysisPipeline(),
    private readonly clock: Clock = new SystemClock(),
    private readonly idGenerator: IdGenerator =
      new UuidGenerator(),
  ) {}

  async execute(
    input: ExecutePersistedAnalysisInput<TSource>,
  ): Promise<PersistedAnalysisExecutionResult> {
    const analysisRunId =
      input.analysisRunId?.trim() ||
      this.idGenerator.create("analysis_run");
    const created = await this.repository.create({
      schemaVersion: ANALYSIS_RUN_SCHEMA_VERSION,
      analysisRunId,
      creatorId: input.creatorId,
      channelId: input.channelId,
      source: {
        sourceType: this.adapter.definition.sourceType,
        sourceSchemaVersion:
          this.adapter.definition.supportedSchemaVersion,
        ...(input.sourceReference
          ? { sourceReference: input.sourceReference }
          : {}),
      },
      pipelineVersion: CREATOR_ANALYSIS_PIPELINE_VERSION,
      ...(input.correlationId
        ? { correlationId: input.correlationId }
        : {}),
      ...(input.attempt !== undefined
        ? { attempt: input.attempt }
        : {}),
      ...(input.retryOfAnalysisRunId
        ? { retryOfAnalysisRunId: input.retryOfAnalysisRunId }
        : {}),
    });

    if (created.status === "failure") {
      return this.persistenceFailure(
        analysisRunId,
        created.error,
      );
    }

    const processing = await this.repository.updateStatus(
      analysisRunId,
      "processing",
    );
    if (processing.status === "failure") {
      return this.persistenceFailure(
        analysisRunId,
        processing.error,
      );
    }

    let adapterResult: ChannelDataAdapterResult;
    try {
      adapterResult = this.adapter.adapt(input.sourceData);
    } catch {
      return this.persistFailure(
        analysisRunId,
        "adapter",
        {
          code: "CHANNEL_DATA_ADAPTER_FAILED",
          message: "Channel data adapter failed unexpectedly.",
        },
      );
    }

    if (adapterResult.status === "failure") {
      return this.persistFailure(
        analysisRunId,
        "adapter",
        {
          code: "CHANNEL_DATA_ADAPTER_FAILED",
          message: this.adapterFailureMessage(adapterResult),
        },
        adapterResult,
      );
    }

    if (
      adapterResult.rawChannelData.creator.id.trim() !==
        input.creatorId.trim() ||
      adapterResult.rawChannelData.channel.id.trim() !==
        input.channelId.trim()
    ) {
      return this.persistFailure(
        analysisRunId,
        "adapter",
        {
          code: "SOURCE_IDENTITY_MISMATCH",
          message:
            "Adapted creator or channel identity does not match the requested run.",
        },
        adapterResult,
      );
    }

    let analysis;
    try {
      analysis = this.pipeline.run(
        adapterResult.rawChannelData,
        {
          analysisId: `analysis_${analysisRunId}`,
          analyzedAt: this.clock.now(),
        },
      ).analysis;
    } catch {
      return this.persistFailure(
        analysisRunId,
        "pipeline",
        {
          code: "CREATOR_ANALYSIS_PIPELINE_FAILED",
          message: "Creator analysis pipeline failed.",
        },
        adapterResult,
      );
    }

    const completed = await this.repository.complete(
      analysisRunId,
      {
        analysisResult: analysis,
        adapterMetadata: adapterResult.metadata,
        adapterWarnings: adapterResult.warnings,
      },
    );
    if (completed.status === "failure") {
      return this.persistenceFailure(
        analysisRunId,
        completed.error,
      );
    }

    return {
      status: "completed",
      analysisRunId,
      adapterStatus: adapterResult.status,
      run: completed.value,
    };
  }

  private async persistFailure(
    analysisRunId: string,
    stage: "adapter" | "pipeline",
    error: PersistedAnalysisExecutionError,
    adapterResult?: ChannelDataAdapterResult,
  ): Promise<PersistedAnalysisExecutionResult> {
    const failed = await this.repository.fail(analysisRunId, {
      failure: {
        stage,
        code: error.code,
        message: error.message,
      },
      ...(adapterResult
        ? {
            adapterMetadata: adapterResult.metadata,
            adapterWarnings: adapterResult.warnings,
          }
        : {}),
    });

    if (failed.status === "failure") {
      return this.persistenceFailure(
        analysisRunId,
        failed.error,
      );
    }

    return {
      status: "failed",
      stage,
      analysisRunId,
      error,
      run: failed.value,
    };
  }

  private persistenceFailure(
    analysisRunId: string,
    error: AnalysisRunRepositoryError,
  ): PersistedAnalysisExecutionResult {
    return {
      status: "failed",
      stage: "persistence",
      analysisRunId,
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  private adapterFailureMessage(
    result: Extract<
      ChannelDataAdapterResult,
      { status: "failure" }
    >,
  ): string {
    return result.errors
      .map((error) => `${error.path}:${error.code}`)
      .join(",");
  }
}

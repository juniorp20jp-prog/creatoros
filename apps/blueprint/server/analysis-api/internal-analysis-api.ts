import type {
  InternalAnalysisApiDependencies,
  ReplayAnalysisResponse,
  RunAnalysisResponse,
} from "./contracts";
import { InternalAnalysisApiResponder } from "./response";
import {
  parseAnalysisRunId,
  parseDeleteAnalysisQuery,
  parseListAnalysisQuery,
  parseReplayAnalysisRequest,
  parseRunAnalysisRequest,
  parseStatusSummaryQuery,
  type ValidationResult,
} from "./validation";

export class InternalAnalysisApi {
  constructor(
    private readonly dependencies: InternalAnalysisApiDependencies,
  ) {}

  runAnalysis(request: Request): Promise<Response> {
    return this.execute(async (respond) => {
      const parsed = await parseRunAnalysisRequest(request);
      if (parsed.status === "invalid") {
        return this.validationFailure(respond, parsed);
      }
      const fixture = this.dependencies.fixtureCatalog.get(
        parsed.value.fixtureId,
      );
      if (!fixture) {
        return respond.failure({
          status: 404,
          code: "FIXTURE_NOT_FOUND",
          message: "The requested internal analysis fixture was not found.",
        });
      }
      if (
        fixture.creatorId !== parsed.value.creatorId ||
        fixture.channelId !== parsed.value.channelId
      ) {
        return respond.failure({
          status: 422,
          code: "FIXTURE_IDENTITY_MISMATCH",
          message:
            "The request identity does not match the selected fixture.",
        });
      }
      const result = await this.dependencies.analysisService.runAnalysis({
        sourceData: fixture.sourceData,
        creatorId: parsed.value.creatorId,
        channelId: parsed.value.channelId,
        sourceReference: `fixture:${fixture.fixtureId}`,
        ...(parsed.value.correlationId
          ? { correlationId: parsed.value.correlationId }
          : {}),
        ...(parsed.value.analysisRunId
          ? { analysisRunId: parsed.value.analysisRunId }
          : {}),
      });
      if (result.status === "failure") {
        return respond.serviceFailure(result.error);
      }
      const details = await this.dependencies.analysisQueryService
        .getAnalysisById(result.value.analysisRunId);
      if (details.status === "failure") {
        return respond.queryFailure(details.error);
      }
      const response: RunAnalysisResponse = {
        analysisRunId: result.value.analysisRunId,
        analysis: details.value,
      };
      return respond.success(response, 201);
    });
  }

  getAnalysis(analysisRunId: string): Promise<Response> {
    return this.execute(async (respond) => {
      const parsedId = parseAnalysisRunId(analysisRunId);
      if (parsedId.status === "invalid") {
        return this.validationFailure(respond, parsedId);
      }
      const result = await this.dependencies.analysisQueryService
        .getAnalysisById(parsedId.value);
      return result.status === "success"
        ? respond.success(result.value)
        : respond.queryFailure(result.error);
    });
  }

  listAnalysisRuns(request: Request): Promise<Response> {
    return this.execute(async (respond) => {
      const query = parseListAnalysisQuery(request);
      if (query.status === "invalid") {
        return this.validationFailure(respond, query);
      }
      const result = await this.dependencies.analysisQueryService
        .listAnalysisRuns(query.value);
      return result.status === "success"
        ? respond.success(result.value)
        : respond.queryFailure(result.error);
    });
  }

  getAnalysisHistory(analysisRunId: string): Promise<Response> {
    return this.execute(async (respond) => {
      const parsedId = parseAnalysisRunId(analysisRunId);
      if (parsedId.status === "invalid") {
        return this.validationFailure(respond, parsedId);
      }
      const result = await this.dependencies.analysisQueryService
        .getAnalysisHistory({ analysisRunId: parsedId.value });
      return result.status === "success"
        ? respond.success(result.value)
        : respond.queryFailure(result.error);
    });
  }

  replayAnalysis(
    request: Request,
    analysisRunId: string,
  ): Promise<Response> {
    return this.execute(async (respond) => {
      const parsedId = parseAnalysisRunId(analysisRunId);
      if (parsedId.status === "invalid") {
        return this.validationFailure(respond, parsedId);
      }
      const parsed = await parseReplayAnalysisRequest(request);
      if (parsed.status === "invalid") {
        return this.validationFailure(respond, parsed);
      }
      const fixture = this.dependencies.fixtureCatalog.get(
        parsed.value.fixtureId,
      );
      if (!fixture) {
        return respond.failure({
          status: 404,
          code: "FIXTURE_NOT_FOUND",
          message: "The requested internal analysis fixture was not found.",
        });
      }
      const result = await this.dependencies.analysisService.replayAnalysis({
        analysisRunId: parsedId.value,
        sourceData: fixture.sourceData,
        sourceReference: `fixture:${fixture.fixtureId}`,
        ...(parsed.value.correlationId
          ? { correlationId: parsed.value.correlationId }
          : {}),
        ...(parsed.value.newAnalysisRunId
          ? { newAnalysisRunId: parsed.value.newAnalysisRunId }
          : {}),
      });
      if (result.status === "failure") {
        return respond.serviceFailure(result.error);
      }
      const details = await this.dependencies.analysisQueryService
        .getAnalysisById(result.value.analysisRunId);
      if (details.status === "failure") {
        return respond.queryFailure(details.error);
      }
      const response: ReplayAnalysisResponse = {
        analysisRunId: result.value.analysisRunId,
        replayedFromAnalysisRunId:
          result.value.replayedFromAnalysisRunId,
        analysis: details.value,
      };
      return respond.success(response, 201);
    });
  }

  deleteAnalysis(
    request: Request,
    analysisRunId: string,
  ): Promise<Response> {
    return this.execute(async (respond) => {
      const parsedId = parseAnalysisRunId(analysisRunId);
      if (parsedId.status === "invalid") {
        return this.validationFailure(respond, parsedId);
      }
      const options = parseDeleteAnalysisQuery(request);
      if (options.status === "invalid") {
        return this.validationFailure(respond, options);
      }
      const result = await this.dependencies.analysisService.deleteAnalysis(
        parsedId.value,
        options.value,
      );
      return result.status === "success"
        ? respond.success({
            analysisRunId: result.value.analysisRunId,
            deleted: true as const,
            revision: result.value.revision,
          })
        : respond.serviceFailure(result.error);
    });
  }

  summarizeAnalysisRuns(request: Request): Promise<Response> {
    return this.execute(async (respond) => {
      const query = parseStatusSummaryQuery(request);
      if (query.status === "invalid") {
        return this.validationFailure(respond, query);
      }
      const result = await this.dependencies.analysisQueryService
        .summarizeAnalysisRuns(query.value);
      return result.status === "success"
        ? respond.success(result.value)
        : respond.queryFailure(result.error);
    });
  }

  private async execute(
    action: (
      responder: InternalAnalysisApiResponder,
    ) => Promise<Response>,
  ): Promise<Response> {
    const responder = new InternalAnalysisApiResponder(
      this.dependencies.clock,
      this.dependencies.requestIdGenerator,
    );
    try {
      return await action(responder);
    } catch {
      return responder.internalFailure();
    }
  }

  private validationFailure(
    responder: InternalAnalysisApiResponder,
    result: Extract<ValidationResult<unknown>, { status: "invalid" }>,
  ): Response {
    return responder.failure(
      {
        status: result.code === "PAYLOAD_TOO_LARGE" ? 413 : 400,
        code: result.code,
        message:
          result.code === "INVALID_JSON"
            ? "The request body is not valid JSON."
            : result.code === "PAYLOAD_TOO_LARGE"
              ? "The request body is too large."
              : "The request is invalid.",
      },
      result.details,
    );
  }
}

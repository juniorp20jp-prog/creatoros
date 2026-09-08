import type {
  AnalysisDetails,
  AnalysisQueryFilters,
} from "../../core";
import type {
  AuthenticatedAnalysisPrincipal,
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
  constructor(private readonly dependencies: InternalAnalysisApiDependencies) {}

  runAnalysis(
    request: Request,
    principal?: AuthenticatedAnalysisPrincipal,
  ): Promise<Response> {
    return this.execute(async (respond) => {
      const parsed = await parseRunAnalysisRequest(request);
      if (parsed.status === "invalid") return this.validationFailure(respond, parsed);

      if (parsed.value.source === "connected-youtube") {
        const connected = await this.resolveConnectedSource(respond, principal);
        if (connected instanceof Response) return connected;
        const result = await connected.analysisService.runAnalysis({
          sourceData: connected.source,
          creatorId: connected.source.creator.userId,
          channelId: connected.source.channel.channelId,
          sourceReference:
            connected.source.synchronizationReference ??
            `youtube-channel:${connected.source.channel.channelId}`,
          ...(parsed.value.correlationId ? { correlationId: parsed.value.correlationId } : {}),
          ...(parsed.value.analysisRunId ? { analysisRunId: parsed.value.analysisRunId } : {}),
        });
        return this.runResponse(respond, result, 201);
      }

      const fixture = this.dependencies.fixtureCatalog.get(parsed.value.fixtureId);
      if (!fixture) {
        return respond.failure({ status: 404, code: "FIXTURE_NOT_FOUND", message: "The requested internal analysis fixture was not found." });
      }
      if (fixture.creatorId !== parsed.value.creatorId || fixture.channelId !== parsed.value.channelId) {
        return respond.failure({ status: 422, code: "FIXTURE_IDENTITY_MISMATCH", message: "The request identity does not match the selected fixture." });
      }
      const result = await this.dependencies.analysisService.runAnalysis({
        sourceData: fixture.sourceData,
        creatorId: parsed.value.creatorId,
        channelId: parsed.value.channelId,
        sourceReference: `fixture:${fixture.fixtureId}`,
        ...(parsed.value.correlationId ? { correlationId: parsed.value.correlationId } : {}),
        ...(parsed.value.analysisRunId ? { analysisRunId: parsed.value.analysisRunId } : {}),
      });
      return this.runResponse(respond, result, 201);
    });
  }

  getAnalysis(
    analysisRunId: string,
    principal?: AuthenticatedAnalysisPrincipal,
  ): Promise<Response> {
    return this.execute(async (respond) => {
      const parsedId = parseAnalysisRunId(analysisRunId);
      if (parsedId.status === "invalid") return this.validationFailure(respond, parsedId);
      const result = await this.dependencies.analysisQueryService.getAnalysisById(parsedId.value);
      if (result.status === "failure") return respond.queryFailure(result.error);
      const denied = this.denyForeignRealRun(respond, result.value, principal);
      return denied ?? respond.success(result.value);
    });
  }

  listAnalysisRuns(
    request: Request,
    principal?: AuthenticatedAnalysisPrincipal,
  ): Promise<Response> {
    return this.execute(async (respond) => {
      const query = parseListAnalysisQuery(request);
      if (query.status === "invalid") return this.validationFailure(respond, query);
      const filters = await this.realFilters(request, respond, principal, query.value.filters);
      if (filters instanceof Response) return filters;
      const result = await this.dependencies.analysisQueryService.listAnalysisRuns({
        ...query.value,
        filters,
      });
      return result.status === "success" ? respond.success(result.value) : respond.queryFailure(result.error);
    });
  }

  getAnalysisHistory(
    analysisRunId: string,
    principal?: AuthenticatedAnalysisPrincipal,
  ): Promise<Response> {
    return this.execute(async (respond) => {
      const parsedId = parseAnalysisRunId(analysisRunId);
      if (parsedId.status === "invalid") return this.validationFailure(respond, parsedId);
      const details = await this.dependencies.analysisQueryService.getAnalysisById(parsedId.value);
      if (details.status === "failure") return respond.queryFailure(details.error);
      const denied = this.denyForeignRealRun(respond, details.value, principal);
      if (denied) return denied;
      const result = await this.dependencies.analysisQueryService.getAnalysisHistory({ analysisRunId: parsedId.value });
      return result.status === "success" ? respond.success(result.value) : respond.queryFailure(result.error);
    });
  }

  replayAnalysis(
    request: Request,
    analysisRunId: string,
    principal?: AuthenticatedAnalysisPrincipal,
  ): Promise<Response> {
    return this.execute(async (respond) => {
      const parsedId = parseAnalysisRunId(analysisRunId);
      if (parsedId.status === "invalid") return this.validationFailure(respond, parsedId);
      const parsed = await parseReplayAnalysisRequest(request);
      if (parsed.status === "invalid") return this.validationFailure(respond, parsed);

      const original = await this.dependencies.analysisQueryService.getAnalysisById(parsedId.value);
      if (original.status === "failure") return respond.queryFailure(original.error);
      const denied = this.denyForeignRealRun(respond, original.value, principal);
      if (denied) return denied;

      if (parsed.value.source === "connected-youtube") {
        if (original.value.source.sourceType !== "connected-youtube") {
          return respond.failure({ status: 422, code: "INVALID_REQUEST", message: "Connected YouTube reanalysis requires a real connected-source run." });
        }
        const connected = await this.resolveConnectedSource(respond, principal);
        if (connected instanceof Response) return connected;
        const result = await connected.analysisService.replayAnalysis({
          analysisRunId: parsedId.value,
          sourceData: connected.source,
          sourceReference:
            connected.source.synchronizationReference ??
            `youtube-channel:${connected.source.channel.channelId}`,
          ...(parsed.value.correlationId ? { correlationId: parsed.value.correlationId } : {}),
          ...(parsed.value.newAnalysisRunId ? { newAnalysisRunId: parsed.value.newAnalysisRunId } : {}),
        });
        return this.replayResponse(respond, result);
      }

      const fixture = this.dependencies.fixtureCatalog.get(parsed.value.fixtureId);
      if (!fixture) {
        return respond.failure({ status: 404, code: "FIXTURE_NOT_FOUND", message: "The requested internal analysis fixture was not found." });
      }
      const result = await this.dependencies.analysisService.replayAnalysis({
        analysisRunId: parsedId.value,
        sourceData: fixture.sourceData,
        sourceReference: `fixture:${fixture.fixtureId}`,
        ...(parsed.value.correlationId ? { correlationId: parsed.value.correlationId } : {}),
        ...(parsed.value.newAnalysisRunId ? { newAnalysisRunId: parsed.value.newAnalysisRunId } : {}),
      });
      return this.replayResponse(respond, result);
    });
  }

  deleteAnalysis(
    request: Request,
    analysisRunId: string,
    principal?: AuthenticatedAnalysisPrincipal,
  ): Promise<Response> {
    return this.execute(async (respond) => {
      const parsedId = parseAnalysisRunId(analysisRunId);
      if (parsedId.status === "invalid") return this.validationFailure(respond, parsedId);
      const options = parseDeleteAnalysisQuery(request);
      if (options.status === "invalid") return this.validationFailure(respond, options);
      const details = await this.dependencies.analysisQueryService.getAnalysisById(parsedId.value);
      if (details.status === "failure") return respond.queryFailure(details.error);
      const denied = this.denyForeignRealRun(respond, details.value, principal);
      if (denied) return denied;
      const result = await this.dependencies.analysisService.deleteAnalysis(parsedId.value, options.value);
      return result.status === "success"
        ? respond.success({ analysisRunId: result.value.analysisRunId, deleted: true as const, revision: result.value.revision })
        : respond.serviceFailure(result.error);
    });
  }

  summarizeAnalysisRuns(
    request: Request,
    principal?: AuthenticatedAnalysisPrincipal,
  ): Promise<Response> {
    return this.execute(async (respond) => {
      const query = parseStatusSummaryQuery(request);
      if (query.status === "invalid") return this.validationFailure(respond, query);
      const filters = await this.realFilters(request, respond, principal, query.value.filters);
      if (filters instanceof Response) return filters;
      const result = await this.dependencies.analysisQueryService.summarizeAnalysisRuns({ filters });
      return result.status === "success" ? respond.success(result.value) : respond.queryFailure(result.error);
    });
  }

  private async resolveConnectedSource(
    respond: InternalAnalysisApiResponder,
    principal: AuthenticatedAnalysisPrincipal | undefined,
  ) {
    if (!principal || !this.dependencies.connectedYouTube) {
      return respond.failure({ status: 403, code: "ANALYSIS_FORBIDDEN", message: "The requested analysis resource is not available." });
    }
    const source = await this.dependencies.connectedYouTube.sourceResolver.resolve(principal);
    if (source.status === "failure") {
      return respond.failure({
        status: source.error.code === "persistence-failure" ? 500 : 422,
        code: source.error.code === "persistence-failure" ? "ANALYSIS_PERSISTENCE_FAILED" : "CONNECTED_SOURCE_NOT_READY",
        message: source.error.message,
      });
    }
    return { source: source.value, analysisService: this.dependencies.connectedYouTube.analysisService };
  }

  private async realFilters(
    request: Request,
    respond: InternalAnalysisApiResponder,
    principal: AuthenticatedAnalysisPrincipal | undefined,
    filters: AnalysisQueryFilters,
  ): Promise<AnalysisQueryFilters | Response> {
    if (new URL(request.url).searchParams.get("source") !== "connected-youtube") return filters;
    const connected = await this.resolveConnectedSource(respond, principal);
    return connected instanceof Response
      ? connected
      : { ...filters, creatorId: connected.source.creator.userId, channelId: connected.source.channel.channelId };
  }

  private denyForeignRealRun(
    respond: InternalAnalysisApiResponder,
    details: AnalysisDetails,
    principal: AuthenticatedAnalysisPrincipal | undefined,
  ): Response | undefined {
    if (
      details.source.sourceType === "connected-youtube" &&
      (!principal || details.summary.creatorId !== principal.userId)
    ) {
      return respond.failure({ status: 404, code: "ANALYSIS_NOT_FOUND", message: "The requested analysis run was not found." });
    }
    return undefined;
  }

  private async runResponse(
    respond: InternalAnalysisApiResponder,
    result: Awaited<ReturnType<InternalAnalysisApiDependencies["analysisService"]["runAnalysis"]>>,
    status: number,
  ): Promise<Response> {
    if (result.status === "failure") return respond.serviceFailure(result.error);
    const details = await this.dependencies.analysisQueryService.getAnalysisById(result.value.analysisRunId);
    if (details.status === "failure") return respond.queryFailure(details.error);
    const response: RunAnalysisResponse = { analysisRunId: result.value.analysisRunId, analysis: details.value };
    return respond.success(response, status);
  }

  private async replayResponse(
    respond: InternalAnalysisApiResponder,
    result: Awaited<ReturnType<InternalAnalysisApiDependencies["analysisService"]["replayAnalysis"]>>,
  ): Promise<Response> {
    if (result.status === "failure") return respond.serviceFailure(result.error);
    const details = await this.dependencies.analysisQueryService.getAnalysisById(result.value.analysisRunId);
    if (details.status === "failure") return respond.queryFailure(details.error);
    const response: ReplayAnalysisResponse = {
      analysisRunId: result.value.analysisRunId,
      replayedFromAnalysisRunId: result.value.replayedFromAnalysisRunId,
      analysis: details.value,
    };
    return respond.success(response, 201);
  }

  private async execute(action: (responder: InternalAnalysisApiResponder) => Promise<Response>): Promise<Response> {
    const responder = new InternalAnalysisApiResponder(this.dependencies.clock, this.dependencies.requestIdGenerator);
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
    return responder.failure({
      status: result.code === "PAYLOAD_TOO_LARGE" ? 413 : 400,
      code: result.code,
      message:
        result.code === "INVALID_JSON"
          ? "The request body is not valid JSON."
          : result.code === "PAYLOAD_TOO_LARGE"
            ? "The request body is too large."
            : "The request is invalid.",
    }, result.details);
  }
}
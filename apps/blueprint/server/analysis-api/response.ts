import type {
  AnalysisQueryError,
  AnalysisServiceError,
  Clock,
  IdGenerator,
} from "../../core";
import {
  INTERNAL_ANALYSIS_API_VERSION,
  type InternalAnalysisApiErrorCode,
  type InternalAnalysisApiFailure,
  type InternalAnalysisApiSuccess,
  type InternalAnalysisApiValidationDetail,
} from "./contracts";

type ApiFailureDefinition = {
  status: number;
  code: InternalAnalysisApiErrorCode;
  message: string;
};

export class InternalAnalysisApiResponder {
  private readonly requestId: string;

  constructor(
    private readonly clock: Clock,
    requestIdGenerator: IdGenerator,
  ) {
    this.requestId = requestIdGenerator.create("request");
  }

  success<TData>(data: TData, status = 200): Response {
    const envelope: InternalAnalysisApiSuccess<TData> = {
      data,
      meta: this.meta(),
    };
    return json(envelope, status);
  }

  failure(
    definition: ApiFailureDefinition,
    details: ReadonlyArray<InternalAnalysisApiValidationDetail> = [],
  ): Response {
    const envelope: InternalAnalysisApiFailure = {
      error: {
        code: definition.code,
        message: definition.message,
        details,
      },
      meta: this.meta(),
    };
    return json(envelope, definition.status);
  }

  serviceFailure(error: AnalysisServiceError): Response {
    return this.failure(mapAnalysisServiceError(error));
  }

  queryFailure(error: AnalysisQueryError): Response {
    return this.failure(mapAnalysisQueryError(error));
  }

  internalFailure(): Response {
    return this.failure({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "The internal analysis request could not be completed.",
    });
  }

  private meta() {
    return {
      apiVersion: INTERNAL_ANALYSIS_API_VERSION,
      requestId: this.requestId,
      timestamp: this.clock.now(),
    };
  }
}

export function mapAnalysisServiceError(
  error: AnalysisServiceError,
): ApiFailureDefinition {
  if (
    error.code === "concurrency-conflict" ||
    error.causeCode === "concurrency-conflict"
  ) {
    return {
      status: 409,
      code: "CONCURRENCY_CONFLICT",
      message:
        "The analysis run changed before the requested operation completed.",
    };
  }
  if (error.causeCode === "duplicate-id") {
    return {
      status: 409,
      code: "DUPLICATE_ANALYSIS_RUN_ID",
      message: "An analysis run with that identifier already exists.",
    };
  }
  switch (error.code) {
    case "validation-failure":
      return {
        status: 400,
        code: "INVALID_REQUEST",
        message: "The analysis request is invalid.",
      };
    case "not-found":
      return {
        status: 404,
        code: "ANALYSIS_NOT_FOUND",
        message: "The requested analysis run was not found.",
      };
    case "adapter-failure":
      return {
        status: 422,
        code: "ANALYSIS_ADAPTER_FAILED",
        message: "The selected fixture could not be normalized.",
      };
    case "pipeline-failure":
      return {
        status: 422,
        code: "ANALYSIS_PIPELINE_FAILED",
        message: "The selected fixture could not be analyzed.",
      };
    case "persistence-failure":
    case "repository-failure":
      return {
        status: 500,
        code: "ANALYSIS_PERSISTENCE_FAILED",
        message: "Analysis persistence could not complete the operation.",
      };
  }
}

export function mapAnalysisQueryError(
  error: AnalysisQueryError,
): ApiFailureDefinition {
  switch (error.code) {
    case "invalid-query":
    case "invalid-cursor":
      return {
        status: 400,
        code: "INVALID_REQUEST",
        message: "The analysis query is invalid.",
      };
    case "not-found":
      return {
        status: 404,
        code: "ANALYSIS_NOT_FOUND",
        message: "The requested analysis run was not found.",
      };
    case "repository-failure":
      return {
        status: 500,
        code: "ANALYSIS_PERSISTENCE_FAILED",
        message: "Analysis persistence could not complete the query.",
      };
    case "query-failure":
      return {
        status: 500,
        code: "INTERNAL_ERROR",
        message: "The internal analysis query could not be completed.",
      };
  }
}

function json(value: unknown, status: number): Response {
  return Response.json(value, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}

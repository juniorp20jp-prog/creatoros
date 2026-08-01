export type AnalysisApiClientErrorKind =
  | "invalid-request"
  | "not-found"
  | "conflict"
  | "unprocessable"
  | "server"
  | "network"
  | "cancelled"
  | "invalid-response";

export type AnalysisApiClientMessageKey =
  | "analysis.errors.invalidRequest"
  | "analysis.errors.notFound"
  | "analysis.errors.conflict"
  | "analysis.errors.unprocessable"
  | "analysis.errors.server"
  | "analysis.errors.network"
  | "analysis.errors.cancelled"
  | "analysis.errors.invalidResponse";

type AnalysisApiClientErrorOptions = {
  kind: AnalysisApiClientErrorKind;
  messageKey: AnalysisApiClientMessageKey;
  status: number | null;
  retryable: boolean;
};

export class AnalysisApiClientError extends Error {
  readonly kind: AnalysisApiClientErrorKind;
  readonly messageKey: AnalysisApiClientMessageKey;
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(options: AnalysisApiClientErrorOptions) {
    super(options.messageKey);
    this.name = "AnalysisApiClientError";
    this.kind = options.kind;
    this.messageKey = options.messageKey;
    this.status = options.status;
    this.retryable = options.retryable;
  }
}

export function mapAnalysisHttpError(
  status: number,
): AnalysisApiClientError {
  switch (status) {
    case 400:
    case 413:
      return clientError(
        "invalid-request",
        "analysis.errors.invalidRequest",
        status,
        false,
      );
    case 404:
      return clientError(
        "not-found",
        "analysis.errors.notFound",
        status,
        false,
      );
    case 409:
      return clientError(
        "conflict",
        "analysis.errors.conflict",
        status,
        false,
      );
    case 422:
      return clientError(
        "unprocessable",
        "analysis.errors.unprocessable",
        status,
        false,
      );
    default:
      return clientError(
        "server",
        "analysis.errors.server",
        status,
        status >= 500,
      );
  }
}

export function networkAnalysisError(): AnalysisApiClientError {
  return clientError(
    "network",
    "analysis.errors.network",
    null,
    true,
  );
}

export function cancelledAnalysisError(): AnalysisApiClientError {
  return clientError(
    "cancelled",
    "analysis.errors.cancelled",
    null,
    true,
  );
}

export function invalidAnalysisResponseError(
  status: number | null,
): AnalysisApiClientError {
  return clientError(
    "invalid-response",
    "analysis.errors.invalidResponse",
    status,
    false,
  );
}

export function normalizeAnalysisClientError(
  error: unknown,
): AnalysisApiClientError {
  if (error instanceof AnalysisApiClientError) {
    return error;
  }
  if (
    error instanceof DOMException &&
    error.name === "AbortError"
  ) {
    return cancelledAnalysisError();
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  ) {
    return cancelledAnalysisError();
  }
  return networkAnalysisError();
}

function clientError(
  kind: AnalysisApiClientErrorKind,
  messageKey: AnalysisApiClientMessageKey,
  status: number | null,
  retryable: boolean,
): AnalysisApiClientError {
  return new AnalysisApiClientError({
    kind,
    messageKey,
    status,
    retryable,
  });
}

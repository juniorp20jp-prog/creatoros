export type CreatorAnalysisRunPersistenceErrorCode =
  | "invalid-record"
  | "unsupported-schema-version"
  | "serialization-failed";

export type CreatorAnalysisRunPersistenceIssue = {
  path: string;
  code: string;
  message: string;
};

export class CreatorAnalysisRunPersistenceError extends Error {
  constructor(
    readonly code: CreatorAnalysisRunPersistenceErrorCode,
    readonly issues: ReadonlyArray<CreatorAnalysisRunPersistenceIssue>,
    message = issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "),
  ) {
    super(message);
    this.name = "CreatorAnalysisRunPersistenceError";
  }
}

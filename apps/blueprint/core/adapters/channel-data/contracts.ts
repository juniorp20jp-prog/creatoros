import type { RawChannelData } from "../../engines/creator-intelligence";

export type ChannelDataAdapterDefinition = {
  adapterId: string;
  adapterVersion: string;
  sourceType: string;
  supportedSchemaVersion: string;
};

export type ChannelDataAdapterMetadata =
  ChannelDataAdapterDefinition & {
    processedAt: string;
  };

export type ChannelDataAdapterErrorCode =
  | "EMPTY_IDENTIFIER"
  | "DUPLICATE_VIDEO_ID"
  | "IDENTITY_MISMATCH"
  | "INVALID_DATE"
  | "INVALID_FIELD_TYPE"
  | "INVALID_ROOT"
  | "MISSING_REQUIRED_FIELD"
  | "NEGATIVE_NUMBER"
  | "NON_FINITE_NUMBER"
  | "UNSUPPORTED_SCHEMA_VERSION";

export type ChannelDataAdapterWarningCode =
  | "MISSING_OPTIONAL_FIELD"
  | "UNKNOWN_FIELD_IGNORED";

export type ChannelDataAdapterError = {
  severity: "error";
  code: ChannelDataAdapterErrorCode;
  path: string;
  message: string;
};

export type ChannelDataAdapterWarning = {
  severity: "warning";
  code: ChannelDataAdapterWarningCode;
  path: string;
  message: string;
};

type ChannelDataAdapterResultBase = {
  metadata: ChannelDataAdapterMetadata;
  errors: ReadonlyArray<ChannelDataAdapterError>;
  warnings: ReadonlyArray<ChannelDataAdapterWarning>;
};

export type ChannelDataAdapterSuccess = {
  status: "success";
  rawChannelData: RawChannelData;
} & ChannelDataAdapterResultBase;

export type ChannelDataAdapterPartial = {
  status: "partial";
  rawChannelData: RawChannelData;
} & ChannelDataAdapterResultBase;

export type ChannelDataAdapterFailure = {
  status: "failure";
} & ChannelDataAdapterResultBase;

export type ChannelDataAdapterResult =
  | ChannelDataAdapterSuccess
  | ChannelDataAdapterPartial
  | ChannelDataAdapterFailure;

export interface ChannelDataAdapter<TSource> {
  readonly definition: ChannelDataAdapterDefinition;

  adapt(source: TSource): ChannelDataAdapterResult;
}

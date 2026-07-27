import type {
  RawChannelData,
  RawVideoMetrics,
} from "../../engines/creator-intelligence";
import { SystemClock, type Clock } from "../../services";
import type {
  ChannelDataAdapter,
  ChannelDataAdapterDefinition,
  ChannelDataAdapterError,
  ChannelDataAdapterErrorCode,
  ChannelDataAdapterMetadata,
  ChannelDataAdapterResult,
  ChannelDataAdapterWarning,
} from "./contracts";
import { FIXTURE_CHANNEL_DATA_SCHEMA_VERSION } from "./fixture-source";

const definition = {
  adapterId: "fixture-channel-data",
  adapterVersion: "1.0.0",
  sourceType: "local-fixture",
  supportedSchemaVersion: FIXTURE_CHANNEL_DATA_SCHEMA_VERSION,
} satisfies ChannelDataAdapterDefinition;

const rootFields = [
  "schemaVersion",
  "collectedAt",
  "creator",
  "channel",
  "videos",
] as const;
const creatorFields = [
  "creatorId",
  "displayName",
  "locale",
] as const;
const channelFields = [
  "channelId",
  "ownerCreatorId",
  "title",
  "createdAt",
  "language",
  "market",
  "subscriberCount",
  "lifetimeViewCount",
  "publishedVideoCount",
] as const;
const videoFields = [
  "videoId",
  "publishedAt",
  "viewCount",
  "likeCount",
  "commentCount",
  "durationSeconds",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

class FixtureSourceParser {
  readonly errors: ChannelDataAdapterError[] = [];
  readonly warnings: ChannelDataAdapterWarning[] = [];

  parse(source: unknown): RawChannelData | undefined {
    if (!isRecord(source)) {
      this.error(
        "INVALID_ROOT",
        "$",
        "Fixture channel data must be a plain object.",
      );
      return undefined;
    }

    this.unknownFields(source, rootFields, "$");
    const schemaVersion = this.requiredString(
      source,
      "schemaVersion",
      "$.schemaVersion",
    );

    if (
      schemaVersion !== undefined &&
      schemaVersion !== FIXTURE_CHANNEL_DATA_SCHEMA_VERSION
    ) {
      this.error(
        "UNSUPPORTED_SCHEMA_VERSION",
        "$.schemaVersion",
        `Schema version ${schemaVersion} is not supported.`,
      );
    }

    const collectedAt = this.requiredDate(
      source,
      "collectedAt",
      "$.collectedAt",
    );
    const creator = this.requiredRecord(
      source,
      "creator",
      "$.creator",
    );
    const channel = this.requiredRecord(
      source,
      "channel",
      "$.channel",
    );
    const videos = this.requiredArray(
      source,
      "videos",
      "$.videos",
    );

    const parsedCreator = creator
      ? this.parseCreator(creator)
      : undefined;
    const parsedChannel = channel
      ? this.parseChannel(channel)
      : undefined;
    const parsedVideos = videos
      ? this.parseVideos(videos)
      : undefined;

    if (
      parsedCreator !== undefined &&
      parsedChannel !== undefined &&
      parsedCreator.id !== parsedChannel.creatorId
    ) {
      this.error(
        "IDENTITY_MISMATCH",
        "$.channel.ownerCreatorId",
        "Channel owner must match creator identity.",
      );
    }

    if (
      this.errors.length > 0 ||
      collectedAt === undefined ||
      parsedCreator === undefined ||
      parsedChannel === undefined ||
      parsedVideos === undefined
    ) {
      return undefined;
    }

    return {
      collectedAt,
      creator: parsedCreator,
      channel: parsedChannel,
      videos: parsedVideos,
    };
  }

  private parseCreator(record: Record<string, unknown>) {
    this.unknownFields(record, creatorFields, "$.creator");
    const id = this.requiredIdentifier(
      record,
      "creatorId",
      "$.creator.creatorId",
    );
    const displayName = this.optionalString(
      record,
      "displayName",
      "$.creator.displayName",
    );
    const locale = this.optionalString(
      record,
      "locale",
      "$.creator.locale",
    );

    if (id === undefined) {
      return undefined;
    }

    return {
      id,
      displayName,
      locale,
    };
  }

  private parseChannel(record: Record<string, unknown>) {
    this.unknownFields(record, channelFields, "$.channel");
    const id = this.requiredIdentifier(
      record,
      "channelId",
      "$.channel.channelId",
    );
    const creatorId = this.requiredIdentifier(
      record,
      "ownerCreatorId",
      "$.channel.ownerCreatorId",
    );
    const subscribers = this.requiredNumber(
      record,
      "subscriberCount",
      "$.channel.subscriberCount",
    );
    const name = this.optionalString(
      record,
      "title",
      "$.channel.title",
    );
    const createdAt = this.optionalDate(
      record,
      "createdAt",
      "$.channel.createdAt",
    );
    const language = this.optionalString(
      record,
      "language",
      "$.channel.language",
    );
    const market = this.optionalString(
      record,
      "market",
      "$.channel.market",
    );
    const totalViews = this.optionalNumber(
      record,
      "lifetimeViewCount",
      "$.channel.lifetimeViewCount",
    );
    const totalVideos = this.optionalNumber(
      record,
      "publishedVideoCount",
      "$.channel.publishedVideoCount",
    );

    if (
      id === undefined ||
      creatorId === undefined ||
      subscribers === undefined
    ) {
      return undefined;
    }

    return {
      id,
      creatorId,
      name,
      createdAt,
      language,
      market,
      subscribers,
      totalViews,
      totalVideos,
    };
  }

  private parseVideos(
    values: ReadonlyArray<unknown>,
  ): ReadonlyArray<RawVideoMetrics> | undefined {
    const videoIds = new Set<string>();
    const videos: RawVideoMetrics[] = [];

    values.forEach((value, index) => {
      const path = `$.videos[${index}]`;

      if (!isRecord(value)) {
        this.error(
          "INVALID_FIELD_TYPE",
          path,
          "Video data must be a plain object.",
        );
        return;
      }

      this.unknownFields(value, videoFields, path);
      const id = this.requiredIdentifier(
        value,
        "videoId",
        `${path}.videoId`,
      );
      const publishedAt = this.requiredDate(
        value,
        "publishedAt",
        `${path}.publishedAt`,
      );
      const views = this.requiredNumber(
        value,
        "viewCount",
        `${path}.viewCount`,
      );
      const likes = this.optionalNumber(
        value,
        "likeCount",
        `${path}.likeCount`,
      );
      const comments = this.optionalNumber(
        value,
        "commentCount",
        `${path}.commentCount`,
      );
      const durationSeconds = this.optionalNumber(
        value,
        "durationSeconds",
        `${path}.durationSeconds`,
      );

      if (
        id === undefined ||
        publishedAt === undefined ||
        views === undefined
      ) {
        return;
      }

      if (videoIds.has(id)) {
        this.error(
          "DUPLICATE_VIDEO_ID",
          `${path}.videoId`,
          `Video id ${id} appears more than once.`,
        );
        return;
      }

      videoIds.add(id);
      videos.push({
        id,
        publishedAt,
        views,
        likes,
        comments,
        durationSeconds,
      });
    });

    return this.errors.length > 0 ? undefined : videos;
  }

  private requiredRecord(
    record: Record<string, unknown>,
    key: string,
    path: string,
  ): Record<string, unknown> | undefined {
    const value = record[key];

    if (value === undefined) {
      this.missingRequired(path);
      return undefined;
    }

    if (!isRecord(value)) {
      this.invalidType(path, "a plain object");
      return undefined;
    }

    return value;
  }

  private requiredArray(
    record: Record<string, unknown>,
    key: string,
    path: string,
  ): ReadonlyArray<unknown> | undefined {
    const value = record[key];

    if (value === undefined) {
      this.missingRequired(path);
      return undefined;
    }

    if (!Array.isArray(value)) {
      this.invalidType(path, "an array");
      return undefined;
    }

    return value;
  }

  private requiredIdentifier(
    record: Record<string, unknown>,
    key: string,
    path: string,
  ): string | undefined {
    const value = this.requiredString(record, key, path);

    if (value !== undefined && value.trim().length === 0) {
      this.error(
        "EMPTY_IDENTIFIER",
        path,
        "Identifier must not be empty.",
      );
      return undefined;
    }

    return value?.trim();
  }

  private requiredString(
    record: Record<string, unknown>,
    key: string,
    path: string,
  ): string | undefined {
    const value = record[key];

    if (value === undefined) {
      this.missingRequired(path);
      return undefined;
    }

    if (typeof value !== "string") {
      this.invalidType(path, "a string");
      return undefined;
    }

    return value;
  }

  private optionalString(
    record: Record<string, unknown>,
    key: string,
    path: string,
  ): string | null | undefined {
    const value = record[key];

    if (value === undefined) {
      this.missingOptional(path);
      return undefined;
    }

    if (value === null) {
      return null;
    }

    if (typeof value !== "string") {
      this.invalidType(path, "a string, null, or undefined");
      return undefined;
    }

    return value;
  }

  private requiredNumber(
    record: Record<string, unknown>,
    key: string,
    path: string,
  ): number | undefined {
    const value = record[key];

    if (value === undefined) {
      this.missingRequired(path);
      return undefined;
    }

    return this.number(value, path);
  }

  private optionalNumber(
    record: Record<string, unknown>,
    key: string,
    path: string,
  ): number | null | undefined {
    const value = record[key];

    if (value === undefined) {
      this.missingOptional(path);
      return undefined;
    }

    if (value === null) {
      return null;
    }

    return this.number(value, path);
  }

  private number(
    value: unknown,
    path: string,
  ): number | undefined {
    if (typeof value !== "number") {
      this.invalidType(path, "a number");
      return undefined;
    }

    if (!Number.isFinite(value)) {
      this.error(
        "NON_FINITE_NUMBER",
        path,
        "Number must be finite.",
      );
      return undefined;
    }

    if (value < 0) {
      this.error(
        "NEGATIVE_NUMBER",
        path,
        "Number must not be negative.",
      );
      return undefined;
    }

    return value;
  }

  private requiredDate(
    record: Record<string, unknown>,
    key: string,
    path: string,
  ): string | undefined {
    const value = this.requiredString(record, key, path);
    return value === undefined
      ? undefined
      : this.date(value, path);
  }

  private optionalDate(
    record: Record<string, unknown>,
    key: string,
    path: string,
  ): string | null | undefined {
    const value = record[key];

    if (value === undefined) {
      this.missingOptional(path);
      return undefined;
    }

    if (value === null) {
      return null;
    }

    if (typeof value !== "string") {
      this.invalidType(path, "an ISO 8601 string, null, or undefined");
      return undefined;
    }

    return this.date(value, path);
  }

  private date(
    value: string,
    path: string,
  ): string | undefined {
    const timestamp = Date.parse(value);

    if (
      !Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString() !== value
    ) {
      this.error(
        "INVALID_DATE",
        path,
        "Date must be a canonical ISO 8601 UTC timestamp.",
      );
      return undefined;
    }

    return value;
  }

  private unknownFields(
    record: Record<string, unknown>,
    knownFields: ReadonlyArray<string>,
    path: string,
  ): void {
    for (const key of Object.keys(record)) {
      if (!knownFields.includes(key)) {
        this.warnings.push({
          severity: "warning",
          code: "UNKNOWN_FIELD_IGNORED",
          path: `${path}.${key}`,
          message: "Unknown field was ignored.",
        });
      }
    }
  }

  private missingRequired(path: string): void {
    this.error(
      "MISSING_REQUIRED_FIELD",
      path,
      "Required field is missing.",
    );
  }

  private missingOptional(path: string): void {
    this.warnings.push({
      severity: "warning",
      code: "MISSING_OPTIONAL_FIELD",
      path,
      message: "Optional field is unavailable and was not invented.",
    });
  }

  private invalidType(path: string, expected: string): void {
    this.error(
      "INVALID_FIELD_TYPE",
      path,
      `Field must be ${expected}.`,
    );
  }

  private error(
    code: ChannelDataAdapterErrorCode,
    path: string,
    message: string,
  ): void {
    this.errors.push({
      severity: "error",
      code,
      path,
      message,
    });
  }
}

export class FixtureChannelDataAdapter
  implements ChannelDataAdapter<unknown>
{
  readonly definition = definition;

  constructor(
    private readonly clock: Clock = new SystemClock(),
  ) {}

  adapt(source: unknown): ChannelDataAdapterResult {
    const parser = new FixtureSourceParser();
    const rawChannelData = parser.parse(source);
    const metadata: ChannelDataAdapterMetadata = {
      ...this.definition,
      processedAt: this.clock.now(),
    };

    if (!rawChannelData || parser.errors.length > 0) {
      return {
        status: "failure",
        errors: parser.errors,
        warnings: parser.warnings,
        metadata,
      };
    }

    return {
      status:
        parser.warnings.length === 0 ? "success" : "partial",
      rawChannelData,
      errors: [],
      warnings: parser.warnings,
      metadata,
    };
  }
}

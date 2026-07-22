import type {
  DataQualityWarning,
  ExcludedVideo,
  YouTubeIntelligenceInput,
  YouTubeValidationIssue,
  YouTubeVideoInput,
} from "./types";

const ISO_DATE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2})))?$/;

export class YouTubeValidationError extends Error {
  constructor(readonly issues: ReadonlyArray<YouTubeValidationIssue>) {
    super(issues.map((issue) => `${issue.field}: ${issue.message}`).join("; "));
    this.name = "YouTubeValidationError";
  }
}

export type ValidatedYouTubeInput = {
  analyzedVideos: ReadonlyArray<YouTubeVideoInput>;
  excludedVideos: ReadonlyArray<ExcludedVideo>;
  warnings: ReadonlyArray<DataQualityWarning>;
};

function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = match[4] === undefined ? 0 : Number(match[4]);
  const minute = match[5] === undefined ? 0 : Number(match[5]);
  const second = match[6] === undefined ? 0 : Number(match[6]);
  const offsetHour = match[7] === undefined ? 0 : Number(match[7]);
  const offsetMinute = match[8] === undefined ? 0 : Number(match[8]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 59 &&
    offsetHour >= 0 &&
    offsetHour <= 23 &&
    offsetMinute >= 0 &&
    offsetMinute <= 59 &&
    Number.isFinite(Date.parse(value))
  );
}

function validateDate(
  value: string,
  field: string,
  issues: Array<YouTubeValidationIssue>,
): number | undefined {
  if (!isValidIsoDate(value)) {
    issues.push({
      field,
      code: "invalid-iso-date",
      message: "must be a valid ISO date interpreted in UTC.",
    });
    return undefined;
  }

  return Date.parse(value);
}

function validateNonEmpty(
  value: string,
  field: string,
  issues: Array<YouTubeValidationIssue>,
): void {
  if (value.trim().length === 0) {
    issues.push({
      field,
      code: "empty-string",
      message: "must be a non-empty string.",
    });
  }
}

function validateNonNegative(
  value: number | undefined,
  field: string,
  issues: Array<YouTubeValidationIssue>,
): void {
  if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
    issues.push({
      field,
      code: "invalid-non-negative-number",
      message: "must be a finite non-negative number.",
    });
  }
}

function validatePercentage(
  value: number | undefined,
  field: string,
  issues: Array<YouTubeValidationIssue>,
): void {
  if (
    value !== undefined &&
    (!Number.isFinite(value) || value < 0 || value > 100)
  ) {
    issues.push({
      field,
      code: "percentage-out-of-range",
      message: "must be a finite percentage between 0 and 100.",
    });
  }
}

export function validateYouTubeIntelligenceInput(
  input: YouTubeIntelligenceInput,
): ValidatedYouTubeInput {
  const issues: Array<YouTubeValidationIssue> = [];
  validateNonEmpty(input.channel.id, "channel.id", issues);
  validateNonEmpty(input.channel.name, "channel.name", issues);
  validateNonNegative(input.channel.subscribers, "channel.subscribers", issues);
  validateNonNegative(input.channel.totalViews, "channel.totalViews", issues);
  validateNonNegative(input.channel.totalVideos, "channel.totalVideos", issues);

  if (input.channel.createdAt !== undefined) {
    validateDate(input.channel.createdAt, "channel.createdAt", issues);
  }

  const analysisDate = validateDate(
    input.context.analysisDate,
    "context.analysisDate",
    issues,
  );
  const periodStart = validateDate(
    input.context.period.startDate,
    "context.period.startDate",
    issues,
  );
  const periodEnd = validateDate(
    input.context.period.endDate,
    "context.period.endDate",
    issues,
  );

  if (
    periodStart !== undefined &&
    periodEnd !== undefined &&
    periodStart > periodEnd
  ) {
    issues.push({
      field: "context.period",
      code: "invalid-period-order",
      message: "startDate must be before or equal to endDate.",
    });
  }

  const seenVideoIds = new Set<string>();
  const datedVideos: Array<{ video: YouTubeVideoInput; timestamp?: number }> = [];

  input.videos.forEach((video, index) => {
    const prefix = `videos[${index}]`;
    validateNonEmpty(video.id, `${prefix}.id`, issues);
    validateNonEmpty(video.title, `${prefix}.title`, issues);

    if (seenVideoIds.has(video.id)) {
      issues.push({
        field: `${prefix}.id`,
        code: "duplicate-video-id",
        message: `duplicates video ID "${video.id}".`,
      });
    }
    seenVideoIds.add(video.id);

    const timestamp = validateDate(
      video.publishedAt,
      `${prefix}.publishedAt`,
      issues,
    );
    if (
      timestamp !== undefined &&
      analysisDate !== undefined &&
      timestamp > analysisDate
    ) {
      issues.push({
        field: `${prefix}.publishedAt`,
        code: "future-video",
        message: "must not be later than context.analysisDate.",
      });
    }

    validateNonNegative(video.durationSeconds, `${prefix}.durationSeconds`, issues);
    validateNonNegative(video.views, `${prefix}.views`, issues);
    validateNonNegative(video.likes, `${prefix}.likes`, issues);
    validateNonNegative(video.comments, `${prefix}.comments`, issues);
    validateNonNegative(video.impressions, `${prefix}.impressions`, issues);
    validateNonNegative(
      video.averageViewDurationSeconds,
      `${prefix}.averageViewDurationSeconds`,
      issues,
    );
    validateNonNegative(
      video.subscribersGained,
      `${prefix}.subscribersGained`,
      issues,
    );
    validatePercentage(video.ctr, `${prefix}.ctr`, issues);
    validatePercentage(
      video.averagePercentageViewed,
      `${prefix}.averagePercentageViewed`,
      issues,
    );

    datedVideos.push({ video, timestamp });
  });

  if (issues.length > 0) {
    throw new YouTubeValidationError(issues);
  }

  const analyzedVideos: Array<YouTubeVideoInput> = [];
  const excludedVideos: Array<ExcludedVideo> = [];

  for (const { video, timestamp } of datedVideos) {
    if (
      timestamp !== undefined &&
      periodStart !== undefined &&
      periodEnd !== undefined &&
      (timestamp < periodStart || timestamp > periodEnd)
    ) {
      excludedVideos.push({
        videoId: video.id,
        reason: "outside-requested-period",
      });
      continue;
    }

    analyzedVideos.push(video);
  }

  const warnings: Array<DataQualityWarning> = [];
  if (excludedVideos.length > 0) {
    warnings.push({
      code: "videos-outside-requested-period",
      message:
        "Valid videos outside the inclusive requested period were excluded from calculations.",
      videoIds: excludedVideos.map((video) => video.videoId),
    });
  }

  return { analyzedVideos, excludedVideos, warnings };
}

import { CreatorAnalysisRunPersistenceError } from "./errors";
import type { CreatorAnalysisRunRepository } from "./repository";
import type { CreatorAnalysisRunRecord } from "./types";
import { parseCreatorAnalysisRunRecord } from "./validation";

function copy(record: CreatorAnalysisRunRecord): CreatorAnalysisRunRecord {
  return structuredClone(record);
}

function compareRecent(
  left: CreatorAnalysisRunRecord,
  right: CreatorAnalysisRunRecord,
): number {
  return (
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt) ||
    left.id.localeCompare(right.id)
  );
}

export class InMemoryCreatorAnalysisRunRepository
  implements CreatorAnalysisRunRepository
{
  private readonly records = new Map<string, CreatorAnalysisRunRecord>();

  async save(
    record: CreatorAnalysisRunRecord,
  ): Promise<CreatorAnalysisRunRecord> {
    const parsed = parseCreatorAnalysisRunRecord(record);
    if (parsed.status === "invalid") {
      throw new CreatorAnalysisRunPersistenceError(
        parsed.error.code,
        parsed.error.issues,
      );
    }

    const stored = copy(parsed.record);
    this.records.set(stored.id, stored);
    return copy(stored);
  }

  async findById(id: string): Promise<CreatorAnalysisRunRecord | null> {
    const record = this.records.get(id);
    return record === undefined ? null : copy(record);
  }

  async listRecent(
    limit?: number,
  ): Promise<ReadonlyArray<CreatorAnalysisRunRecord>> {
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
      throw new RangeError("limit must be a non-negative integer.");
    }
    const records = [...this.records.values()].sort(compareRecent);
    const selected = limit === undefined ? records : records.slice(0, limit);
    return selected.map(copy);
  }
}

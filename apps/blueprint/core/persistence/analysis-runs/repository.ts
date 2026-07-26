import type { CreatorAnalysisRunRecord } from "./types";

/**
 * Storage-agnostic contract. `save` is an upsert by ID and `listRecent`
 * orders by updatedAt descending, then createdAt descending, then ID.
 */
export interface CreatorAnalysisRunRepository {
  save(record: CreatorAnalysisRunRecord): Promise<CreatorAnalysisRunRecord>;
  findById(id: string): Promise<CreatorAnalysisRunRecord | null>;
  listRecent(limit?: number): Promise<ReadonlyArray<CreatorAnalysisRunRecord>>;
}

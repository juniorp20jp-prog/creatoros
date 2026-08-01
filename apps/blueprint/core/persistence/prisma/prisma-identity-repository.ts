import type { CreateIdentityInput, Identity, IdentityRepository, IdentityRepositoryError, IdentityRepositoryResult } from "../../identity";
import { createIdentity } from "../../identity";
import type { AnalysisRunPrismaClient } from "./prisma-client";
import { mapIdentityRow } from "./authentication-row-mappers";

function success<TValue>(value: TValue): IdentityRepositoryResult<TValue> { return { status: "success", value }; }
function failure<TValue>(error: IdentityRepositoryError): IdentityRepositoryResult<TValue> { return { status: "failure", error }; }
function errorCode(error: unknown): string | undefined { return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined; }

export class PrismaIdentityRepository implements IdentityRepository {
  constructor(private readonly client: AnalysisRunPrismaClient) {}

  async create(input: CreateIdentityInput): Promise<IdentityRepositoryResult<Identity>> {
    const validated = createIdentity(input);
    if (validated.status === "failure") return failure(validated.error);
    try {
      const row = await this.client.identityRow.create({ data: { ...validated.value, createdAt: new Date(validated.value.createdAt), updatedAt: new Date(validated.value.updatedAt) } });
      return this.map(row, validated.value.identityId);
    } catch (error) {
      if (errorCode(error) === "P2002") return failure({ code: "duplicate-id", message: "Identity already exists.", entityId: validated.value.identityId });
      if (errorCode(error) === "P2003") return failure({ code: "user-not-found", message: "Identity user was not found.", entityId: validated.value.userId });
      return failure({ code: "persistence-failure", message: "Identity persistence failed." });
    }
  }

  async getById(identityId: string): Promise<IdentityRepositoryResult<Identity>> {
    return this.find({ identityId: identityId.trim() }, identityId);
  }

  async getByUserId(userId: string): Promise<IdentityRepositoryResult<Identity>> {
    return this.find({ userId: userId.trim() }, userId);
  }

  private async find(where: { identityId: string } | { userId: string }, entityId: string): Promise<IdentityRepositoryResult<Identity>> {
    try {
      const row = await this.client.identityRow.findUnique({ where });
      return row ? this.map(row, entityId) : failure({ code: "not-found", message: "Identity was not found.", entityId });
    } catch { return failure({ code: "persistence-failure", message: "Identity persistence failed." }); }
  }

  private map(row: Parameters<typeof mapIdentityRow>[0], entityId: string): IdentityRepositoryResult<Identity> {
    const value = mapIdentityRow(row);
    return value ? success(value) : failure({ code: "persistence-failure", message: "Stored identity data is invalid.", entityId });
  }
}

import type { CreateUserInput, IdentityRepositoryError, IdentityRepositoryResult, User, UserRepository } from "../../identity";
import { createUser, normalizeEmail } from "../../identity";
import type { AnalysisRunPrismaClient } from "./prisma-client";
import { mapUserRow } from "./authentication-row-mappers";

function success<TValue>(value: TValue): IdentityRepositoryResult<TValue> { return { status: "success", value }; }
function failure<TValue>(error: IdentityRepositoryError): IdentityRepositoryResult<TValue> { return { status: "failure", error }; }
function errorCode(error: unknown): string | undefined { return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined; }
function duplicateEmail(error: unknown): boolean { return typeof error === "object" && error !== null && "meta" in error && JSON.stringify(error.meta).includes("email"); }

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly client: AnalysisRunPrismaClient) {}

  async create(input: CreateUserInput): Promise<IdentityRepositoryResult<User>> {
    const validated = createUser(input);
    if (validated.status === "failure") return failure(validated.error);
    try {
      const row = await this.client.userRow.create({ data: { ...validated.value, createdAt: new Date(validated.value.createdAt), updatedAt: new Date(validated.value.updatedAt) } });
      return this.map(row, validated.value.userId);
    } catch (error) {
      if (errorCode(error) === "P2002") return failure({ code: duplicateEmail(error) ? "duplicate-email" : "duplicate-id", message: "User already exists." });
      return failure({ code: "persistence-failure", message: "User persistence failed." });
    }
  }

  async getById(userId: string): Promise<IdentityRepositoryResult<User>> {
    try {
      const row = await this.client.userRow.findUnique({ where: { userId: userId.trim() } });
      return row ? this.map(row, userId) : failure({ code: "not-found", message: "User was not found.", entityId: userId });
    } catch { return failure({ code: "persistence-failure", message: "User persistence failed." }); }
  }

  async getByEmail(email: string): Promise<IdentityRepositoryResult<User>> {
    try {
      const row = await this.client.userRow.findUnique({ where: { email: normalizeEmail(email) } });
      return row ? this.map(row) : failure({ code: "not-found", message: "User was not found." });
    } catch { return failure({ code: "persistence-failure", message: "User persistence failed." }); }
  }

  private map(row: Parameters<typeof mapUserRow>[0], entityId?: string): IdentityRepositoryResult<User> {
    const value = mapUserRow(row);
    return value ? success(value) : failure({ code: "persistence-failure", message: "Stored user data is invalid.", ...(entityId ? { entityId } : {}) });
  }
}

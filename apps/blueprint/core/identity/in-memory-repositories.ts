import type { CreateIdentityInput, CreateUserInput, Identity, User } from "./models";
import { type IdentityRepository, type IdentityRepositoryError, type IdentityRepositoryResult, type UserRepository } from "./repositories";
import { createIdentity, createUser, normalizeEmail } from "./validation";

function success<TValue>(value: TValue): IdentityRepositoryResult<TValue> {
  return { status: "success", value: structuredClone(value) };
}
function failure<TValue>(error: IdentityRepositoryError): IdentityRepositoryResult<TValue> {
  return { status: "failure", error };
}

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  async create(input: CreateUserInput): Promise<IdentityRepositoryResult<User>> {
    const result = createUser(input);
    if (result.status === "failure") return failure(result.error);
    if (this.users.has(result.value.userId)) return failure({ code: "duplicate-id", message: "User identifier already exists.", entityId: result.value.userId });
    if ([...this.users.values()].some((user) => user.email === result.value.email)) return failure({ code: "duplicate-email", message: "User email already exists." });
    this.users.set(result.value.userId, structuredClone(result.value));
    return success(result.value);
  }

  async getById(userId: string): Promise<IdentityRepositoryResult<User>> {
    const value = this.users.get(userId.trim());
    return value ? success(value) : failure({ code: "not-found", message: "User was not found.", entityId: userId });
  }

  async getByEmail(email: string): Promise<IdentityRepositoryResult<User>> {
    const normalized = normalizeEmail(email);
    const value = [...this.users.values()].find((user) => user.email === normalized);
    return value ? success(value) : failure({ code: "not-found", message: "User was not found." });
  }
}

export class InMemoryIdentityRepository implements IdentityRepository {
  private readonly identities = new Map<string, Identity>();
  constructor(private readonly users: UserRepository) {}

  async create(input: CreateIdentityInput): Promise<IdentityRepositoryResult<Identity>> {
    const result = createIdentity(input);
    if (result.status === "failure") return failure(result.error);
    if (this.identities.has(result.value.identityId)) return failure({ code: "duplicate-id", message: "Identity identifier already exists.", entityId: result.value.identityId });
    if ([...this.identities.values()].some((identity) => identity.userId === result.value.userId)) return failure({ code: "duplicate-id", message: "User already has an internal identity.", entityId: result.value.userId });
    const user = await this.users.getById(result.value.userId);
    if (user.status === "failure") return failure({ code: "user-not-found", message: "Identity user was not found.", entityId: result.value.userId });
    this.identities.set(result.value.identityId, structuredClone(result.value));
    return success(result.value);
  }

  async getById(identityId: string): Promise<IdentityRepositoryResult<Identity>> {
    const value = this.identities.get(identityId.trim());
    return value ? success(value) : failure({ code: "not-found", message: "Identity was not found.", entityId: identityId });
  }

  async getByUserId(userId: string): Promise<IdentityRepositoryResult<Identity>> {
    const value = [...this.identities.values()].find((identity) => identity.userId === userId.trim());
    return value ? success(value) : failure({ code: "not-found", message: "Identity was not found.", entityId: userId });
  }
}

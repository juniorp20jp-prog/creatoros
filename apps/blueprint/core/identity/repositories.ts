import type { CreateIdentityInput, CreateUserInput, Identity, IdentityProvider, User } from "./models";

export type IdentityRepositoryErrorCode = "invalid-input" | "duplicate-id" | "duplicate-email" | "not-found" | "user-not-found" | "persistence-failure";
export type IdentityRepositoryError = Readonly<{ code: IdentityRepositoryErrorCode; message: string; entityId?: string }>;
export type IdentityRepositoryResult<TValue> = Readonly<{ status: "success"; value: TValue }> | Readonly<{ status: "failure"; error: IdentityRepositoryError }>;

export interface UserRepository {
  create(input: CreateUserInput): Promise<IdentityRepositoryResult<User>>;
  getById(userId: string): Promise<IdentityRepositoryResult<User>>;
  getByEmail(email: string): Promise<IdentityRepositoryResult<User>>;
}

export interface IdentityRepository {
  create(input: CreateIdentityInput): Promise<IdentityRepositoryResult<Identity>>;
  getById(identityId: string): Promise<IdentityRepositoryResult<Identity>>;
  getByUserId(userId: string): Promise<IdentityRepositoryResult<Identity>>;
  getByProviderSubject(provider: IdentityProvider, providerSubject: string): Promise<IdentityRepositoryResult<Identity>>;
}

import { InMemoryIdentityRepository, InMemoryUserRepository } from "../identity";
import { InMemorySessionRepository } from "../session";
import { runAuthenticationRepositoryContractTests } from "./fixtures/authentication-repository-contract";

runAuthenticationRepositoryContractTests("Authentication repositories/in-memory", () => {
  const users = new InMemoryUserRepository();
  return { users, identities: new InMemoryIdentityRepository(users), sessions: new InMemorySessionRepository(users) };
});

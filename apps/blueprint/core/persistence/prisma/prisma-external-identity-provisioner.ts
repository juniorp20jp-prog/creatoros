import type { ExternalIdentityProvisioner, IdentityProvisioningResult } from "../../authentication";
import { createIdentity, createUser } from "../../identity";
import { mapIdentityRow, mapUserRow } from "./authentication-row-mappers";
import type { AnalysisRunPrismaClient } from "./prisma-client";

function prismaCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined;
}

export class PrismaExternalIdentityProvisioner implements ExternalIdentityProvisioner {
  constructor(private readonly client: AnalysisRunPrismaClient) {}

  async resolveOrProvision(input: Parameters<ExternalIdentityProvisioner["resolveOrProvision"]>[0]): Promise<IdentityProvisioningResult> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const existingIdentity = await transaction.identityRow.findUnique({
          where: { provider_providerSubject: { provider: input.externalIdentity.provider, providerSubject: input.externalIdentity.providerSubject } },
          include: { user: true },
        });
        if (existingIdentity) {
          const identity = mapIdentityRow(existingIdentity);
          const user = mapUserRow(existingIdentity.user);
          return identity && user
            ? { status: "success" as const, identity, user, provisioned: false }
            : this.failure("persistence-failure", "Stored identity data is invalid.");
        }

        const email = input.externalIdentity.email.trim().toLowerCase();
        if (await transaction.userRow.findUnique({ where: { email } })) {
          return this.failure("identity-conflict", "An account with this email already exists and was not linked automatically.");
        }
        const userResult = createUser({
          userId: input.userId,
          email,
          displayName: input.externalIdentity.displayName?.trim() || email,
          locale: input.locale,
          createdAt: input.createdAt,
        });
        const identityResult = createIdentity({
          identityId: input.identityId,
          userId: input.userId,
          provider: input.externalIdentity.provider,
          providerSubject: input.externalIdentity.providerSubject,
          createdAt: input.createdAt,
        });
        if (userResult.status === "failure" || identityResult.status === "failure") {
          return this.failure("user-provisioning-failed", "Verified identity data could not be provisioned.");
        }
        const userRow = await transaction.userRow.create({ data: { ...userResult.value, createdAt: new Date(userResult.value.createdAt), updatedAt: new Date(userResult.value.updatedAt) } });
        const identityRow = await transaction.identityRow.create({ data: { ...identityResult.value, createdAt: new Date(identityResult.value.createdAt), updatedAt: new Date(identityResult.value.updatedAt) } });
        const user = mapUserRow(userRow);
        const identity = mapIdentityRow(identityRow);
        return user && identity
          ? { status: "success" as const, user, identity, provisioned: true }
          : this.failure("persistence-failure", "Provisioned identity data is invalid.");
      });
    } catch (error) {
      return prismaCode(error) === "P2002"
        ? this.failure("identity-conflict", "External identity provisioning conflicted with an existing account.")
        : this.failure("persistence-failure", "External identity persistence failed.");
    }
  }

  private failure(code: "identity-conflict" | "user-provisioning-failed" | "persistence-failure", message: string): IdentityProvisioningResult {
    return { status: "failure", error: { code, message } };
  }
}

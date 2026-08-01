export const BUILT_IN_ROLES = ["owner", "admin", "viewer"] as const;
export type BuiltInRole = (typeof BUILT_IN_ROLES)[number];
export type AuthorizationRole = BuiltInRole | (string & {});

export type AuthorizationSubject = Readonly<{
  userId: string;
  roles: ReadonlyArray<AuthorizationRole>;
}>;

export type AuthorizationRequest = Readonly<{
  subject: AuthorizationSubject;
  action: string;
  resource: string;
  resourceOwnerId?: string;
}>;

export type AuthorizationDecision = Readonly<{
  outcome: "allow" | "deny";
  reason: string;
}>;

/** Contract only. Policies and permission rules are intentionally deferred. */
export interface AuthorizationService {
  authorize(request: AuthorizationRequest): Promise<AuthorizationDecision>;
}

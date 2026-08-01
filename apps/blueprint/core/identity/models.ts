export const SUPPORTED_USER_LOCALES = ["es", "en", "fr", "pt-BR"] as const;

export type UserLocale = (typeof SUPPORTED_USER_LOCALES)[number];
export type UserStatus = "active" | "suspended" | "disabled";
export type IdentityStatus = "active" | "disabled";
export type IdentityProvider = "internal" | "google";

export type User = Readonly<{
  userId: string;
  email: string;
  displayName: string;
  locale: UserLocale;
  timezone?: string;
  createdAt: string;
  updatedAt: string;
  status: UserStatus;
}>;

/** Provider-neutral identity resolved only after future adapter verification. */
export type Identity = Readonly<{
  identityId: string;
  userId: string;
  provider: IdentityProvider;
  providerSubject: string;
  status: IdentityStatus;
  createdAt: string;
  updatedAt: string;
}>;

export type CreateUserInput = Readonly<{
  userId: string;
  email: string;
  displayName: string;
  locale: UserLocale;
  timezone?: string;
  createdAt: string;
  status?: UserStatus;
}>;

export type CreateIdentityInput = Readonly<{
  identityId: string;
  userId: string;
  createdAt: string;
  status?: IdentityStatus;
  provider?: IdentityProvider;
  providerSubject?: string;
}>;

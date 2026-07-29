const DATABASE_URL_KEY = "DATABASE_URL";

export type DatabaseEnvironment = Readonly<Record<string, string | undefined>>;

/**
 * Resolves the server-only connection string without logging or retaining it
 * in repository metadata. Composition roots may inject an explicit URL in
 * tests; production callers should use this function once at startup.
 */
export function requireDatabaseUrl(
  environment: DatabaseEnvironment = process.env,
): string {
  const value = environment[DATABASE_URL_KEY]?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for PostgreSQL persistence.");
  }
  return value;
}

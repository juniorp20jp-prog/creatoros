import { defineConfig } from "prisma/config";

/**
 * Generation does not contact PostgreSQL and therefore must remain usable in
 * clean build environments. Database and migration commands use the strict
 * prisma.config.ts, which requires DATABASE_URL.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
});

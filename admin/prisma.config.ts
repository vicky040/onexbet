import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer reads the connection URL from schema.prisma, and the
// CLI does not load .env.local the way Next.js does — so load it here.
//
// Anything already in the environment has to win over both files, or
// `DATABASE_URL=<production> npm run db:deploy` would silently migrate
// whatever .env.local points at instead.
const fromEnvironment = { ...process.env };

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true, quiet: true });

Object.assign(process.env, fromEnvironment);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --env-file-if-exists=.env --env-file-if-exists=.env.local prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});

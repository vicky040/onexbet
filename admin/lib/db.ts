import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env } from "./env";

// Next.js hot-reloads modules in development, which would otherwise open a
// new pool on every edit.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma 7 talks to Postgres through a driver adapter rather than a URL in
// the schema file.
function createClient() {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: env.databaseUrl,
      // On a serverless host every warm instance keeps its own pool, so a
      // handful of instances can exhaust Postgres' connection limit. Keep
      // each pool tiny there and point DATABASE_URL at a pooler (Neon's
      // -pooler host, Supabase's port 6543). Override with DATABASE_POOL_MAX.
      max: Number(process.env.DATABASE_POOL_MAX ?? (env.isServerless ? 1 : 10)),
      idleTimeoutMillis: 10_000,
    }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** The singleton settings row, created on first access. */
export async function getSettings() {
  return prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}

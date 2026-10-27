import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env } from "./env";
import { ApiError } from "./errors";

// Next.js hot-reloads modules in development, which would otherwise open a
// new pool on every edit.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma 7 talks to Postgres through a driver adapter rather than a URL in
// the schema file.
function createClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    // Logged in full for whoever is deploying; the caller gets the short
    // version, since an infrastructure detail is not theirs to know.
    console.error(
      "[db] DATABASE_URL is not set. Set it on the deployment (see DEPLOY.md).",
    );
    throw new ApiError(
      "server_error",
      "The service is not finished setting up. Please try again shortly.",
    );
  }

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

/**
 * The client is built on first use rather than when this module loads.
 *
 * `next build` imports every route module to collect its configuration, so
 * connecting eagerly would make the build itself depend on runtime secrets —
 * a deployment could not be built before its database existed. Deferring it
 * means a missing DATABASE_URL fails the request that needs it, with a
 * readable error, instead of the build.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = (globalForPrisma.prisma ??= createClient());
    const value = Reflect.get(client, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
  has(_target, property) {
    return property in (globalForPrisma.prisma ??= createClient());
  },
});

/** The singleton settings row, created on first access. */
export async function getSettings() {
  return prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}

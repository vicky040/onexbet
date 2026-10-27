import { prisma } from "@/lib/db";
import { ok, withRoute } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Unauthenticated liveness probe: is the server up and the database reachable? */
export const GET = withRoute(async () => {
  const startedAt = Date.now();
  await prisma.$queryRaw`SELECT 1`;

  return ok({
    status: "ok",
    database: "reachable",
    latencyMs: Date.now() - startedAt,
    time: new Date().toISOString(),
  });
});

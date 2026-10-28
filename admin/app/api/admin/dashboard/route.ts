import { adminScope, scopedByAgentId } from "@/lib/scope";
import { prisma } from "@/lib/db";
import { ok, withRoute } from "@/lib/http";
import { adminDeposit, adminPayout } from "@/lib/admin-serializers";
import { platformOverview } from "@/lib/stats";

export const dynamic = "force-dynamic";

const agentSelect = {
  select: { id: true, name: true, mobile: true, status: true },
} as const;

/** Everything the dashboard screen needs, in one call. */
export const GET = withRoute(async () => {
  const scope = await adminScope();
  const forAgents = scopedByAgentId(scope);

  const [overview, pendingDeposits, reportedPayouts] = await Promise.all([
    platformOverview(scope.agentIds),
    prisma.deposit.findMany({
      where: { status: "PENDING", ...forAgents },
      include: { agent: agentSelect },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 8,
    }),
    prisma.payout.findMany({
      where: { status: "PAYMENT_RECEIVED", ...forAgents },
      include: { agent: agentSelect },
      orderBy: [{ paidAt: "asc" }, { id: "asc" }],
      take: 8,
    }),
  ]);

  return ok({
    overview,
    queues: {
      pendingDeposits: pendingDeposits.map(adminDeposit),
      payoutsAwaitingConfirmation: reportedPayouts.map(adminPayout),
    },
  });
});

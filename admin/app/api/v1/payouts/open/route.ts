import { requireAgent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, withRoute } from "@/lib/http";
import { serializeOpenPayout } from "@/lib/serializers";

export const dynamic = "force-dynamic";

/**
 * Backs WalletRepository.openPayouts() — the payouts the agent may take:
 * the ones assigned to them plus the ones offered to everyone.
 */
export const GET = withRoute(async (request: Request) => {
  const agent = await requireAgent(request);

  const payouts = await prisma.payout.findMany({
    where: {
      status: "OPEN",
      OR: [{ agentId: agent.id }, { agentId: null }],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 50,
  });

  return ok(payouts.map(serializeOpenPayout));
});

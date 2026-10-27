import { requireAgent } from "@/lib/auth";
import { ok, withRoute } from "@/lib/http";
import { agentEarnings } from "@/lib/stats";

export const dynamic = "force-dynamic";

/**
 * Backs WalletRepository.earnings(). `?weeks=` chooses the window
 * (default 8, max 52); week 1 is the current week.
 */
export const GET = withRoute(async (request: Request) => {
  const agent = await requireAgent(request);
  const requested = Number(new URL(request.url).searchParams.get("weeks") ?? 8);
  const weeks = Math.min(52, Math.max(1, Number.isFinite(requested) ? requested : 8));

  return ok(await agentEarnings(agent.id, weeks));
});

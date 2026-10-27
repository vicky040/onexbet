import { requireAgent } from "@/lib/auth";
import { ok, withRoute } from "@/lib/http";
import { agentSummary } from "@/lib/stats";

export const dynamic = "force-dynamic";

/** Backs WalletRepository.summary() — the Home / Payin / History stat tiles. */
export const GET = withRoute(async (request: Request) => {
  const agent = await requireAgent(request);
  return ok(await agentSummary(agent));
});

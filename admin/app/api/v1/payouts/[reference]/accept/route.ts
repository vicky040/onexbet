import { requireAgent } from "@/lib/auth";
import { ok, withRoute } from "@/lib/http";
import { acceptPayout } from "@/lib/operations";
import { serializePayoutPayment } from "@/lib/serializers";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ reference: string }> };

/**
 * The agent claims an open payout. `:reference` is the code the app shows
 * (e.g. LBS0JCLO28RO). Exactly one agent can win a contested payout.
 */
export const POST = withRoute(async (request: Request, { params }: Params) => {
  const agent = await requireAgent(request);
  const { reference } = await params;

  const payout = await acceptPayout({ reference, agentId: agent.id });
  return ok(serializePayoutPayment(payout));
});

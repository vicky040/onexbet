import { requireAgent } from "@/lib/auth";
import { ok, withRoute } from "@/lib/http";
import { markPayoutPaid } from "@/lib/operations";
import { serializePayoutPayment } from "@/lib/serializers";
import { markPayoutPaidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ reference: string }> };

/**
 * The agent reports that they have sent the money to the player's UPI. The
 * balance is only credited once an admin confirms it.
 */
export const POST = withRoute(async (request: Request, { params }: Params) => {
  const agent = await requireAgent(request);
  const { reference } = await params;

  let note: string | undefined;
  try {
    note = markPayoutPaidSchema.parse(await request.json()).note;
  } catch {
    note = undefined;
  }

  const payout = await markPayoutPaid({ reference, agentId: agent.id, note });
  return ok(serializePayoutPayment(payout));
});

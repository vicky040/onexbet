import { requireAdmin } from "@/lib/auth";
import { ok, readBody, withRoute } from "@/lib/http";
import { adjustBalance } from "@/lib/operations";
import { adjustBalanceSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Manual credit (positive amount) or debit (negative). Always audited and
 * the agent is notified; a debit that would go below zero is refused.
 */
export const POST = withRoute(async (request: Request, { params }: Params) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const body = await readBody(request, adjustBalanceSchema);

  const result = await adjustBalance({
    agentId: id,
    amount: body.amount,
    reason: body.reason,
    adminId: admin.id,
  });

  return ok(result);
});

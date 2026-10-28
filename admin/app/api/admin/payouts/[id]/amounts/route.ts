import { requireSuperAdmin } from "@/lib/auth";
import { ok, readBody, withRoute } from "@/lib/http";
import { updatePayoutAmounts } from "@/lib/operations";
import { adminPayout } from "@/lib/admin-serializers";
import { updatePayoutAmountsSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Corrects a payout's amount, rate or destination. Super admin only: a
 * settled payout has already been credited, so the difference is applied to
 * the agent's balance.
 *
 * Status changes stay on PATCH /api/admin/payouts/:id, and settling keeps
 * its own endpoint — this one never changes the lifecycle.
 */
export const PATCH = withRoute(async (request: Request, { params }: Params) => {
  const admin = await requireSuperAdmin();
  const { id } = await params;
  const body = await readBody(request, updatePayoutAmountsSchema);

  const payout = await updatePayoutAmounts({
    payoutId: id,
    amount: body.amount,
    commissionRate: body.commissionRate,
    upiId: body.upiId,
    reason: body.reason,
    adminId: admin.id,
  });

  return ok(adminPayout(payout));
});

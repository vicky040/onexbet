import { requireAdmin } from "@/lib/auth";
import { ok, withRoute } from "@/lib/http";
import { settlePayout } from "@/lib/operations";
import { adminPayout } from "@/lib/admin-serializers";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Confirms the player was paid: the agent is credited the payout amount plus
 * their commission.
 */
export const POST = withRoute(async (_request: Request, { params }: Params) => {
  const admin = await requireAdmin();
  const { id } = await params;

  const payout = await settlePayout({ payoutId: id, adminId: admin.id });
  return ok(adminPayout(payout));
});

import { requireAdmin } from "@/lib/auth";
import { ok, withRoute } from "@/lib/http";
import { failPayout } from "@/lib/operations";
import { adminPayout } from "@/lib/admin-serializers";
import { reviewDepositSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Marks a payout failed. No balance moves; the agent is notified. */
export const POST = withRoute(async (request: Request, { params }: Params) => {
  const admin = await requireAdmin();
  const { id } = await params;

  let note: string | undefined;
  try {
    note = reviewDepositSchema.parse(await request.json()).note;
  } catch {
    note = undefined;
  }

  const payout = await failPayout({ payoutId: id, adminId: admin.id, note });
  return ok(adminPayout(payout));
});

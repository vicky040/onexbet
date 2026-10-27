import { requireAdmin } from "@/lib/auth";
import { ok, withRoute } from "@/lib/http";
import { rejectDeposit } from "@/lib/operations";
import { adminDeposit } from "@/lib/admin-serializers";
import { reviewDepositSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Rejects the deposit. The reason reaches the agent as a notification. */
export const POST = withRoute(async (request: Request, { params }: Params) => {
  const admin = await requireAdmin();
  const { id } = await params;

  let note: string | undefined;
  try {
    note = reviewDepositSchema.parse(await request.json()).note;
  } catch {
    note = undefined;
  }

  const deposit = await rejectDeposit({ depositId: id, adminId: admin.id, note });
  return ok(adminDeposit(deposit));
});

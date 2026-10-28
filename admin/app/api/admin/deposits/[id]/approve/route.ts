import { requireFullAdmin } from "@/lib/auth";
import { ok, withRoute } from "@/lib/http";
import { approveDeposit } from "@/lib/operations";
import { adminDeposit } from "@/lib/admin-serializers";
import { reviewDepositSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Approves the deposit and credits the agent's balance. */
export const POST = withRoute(async (request: Request, { params }: Params) => {
  const admin = await requireFullAdmin();
  const { id } = await params;

  let note: string | undefined;
  try {
    note = reviewDepositSchema.parse(await request.json()).note;
  } catch {
    note = undefined;
  }

  const deposit = await approveDeposit({ depositId: id, adminId: admin.id, note });
  return ok(adminDeposit(deposit));
});

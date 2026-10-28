import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { ok, readBody, withRoute } from "@/lib/http";
import { updatePayin } from "@/lib/operations";
import { adminPayin } from "@/lib/admin-serializers";
import { updatePayinSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export const GET = withRoute(async (_request: Request, { params }: Params) => {
  await requireSuperAdmin();
  const { id } = await params;

  const payin = await prisma.payin.findUnique({
    where: { id },
    include: {
      agent: { select: { id: true, name: true, mobile: true, status: true } },
    },
  });
  if (!payin) throw ApiError.notFound("Payin");

  return ok(adminPayin(payin));
});

/**
 * Corrects a payin. Super admin only, because changing the amount or the
 * rate moves the agent's balance by the difference.
 */
export const PATCH = withRoute(async (request: Request, { params }: Params) => {
  const admin = await requireSuperAdmin();
  const { id } = await params;
  const body = await readBody(request, updatePayinSchema);

  const payin = await updatePayin({
    payinId: id,
    amount: body.amount,
    commissionRate: body.commissionRate,
    txnRef: body.txnRef,
    reason: body.reason,
    adminId: admin.id,
  });

  return ok(adminPayin(payin));
});

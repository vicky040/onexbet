import { requireFullAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { ok, readBody, withRoute } from "@/lib/http";
import { adminPayout } from "@/lib/admin-serializers";
import { updatePayoutSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export const GET = withRoute(async (_request: Request, { params }: Params) => {
  await requireFullAdmin();
  const { id } = await params;

  const payout = await prisma.payout.findUnique({
    where: { id },
    include: {
      agent: { select: { id: true, name: true, mobile: true, status: true } },
    },
  });
  if (!payout) throw ApiError.notFound("Payout");

  return ok(adminPayout(payout));
});

/**
 * Reassigns a payout or edits its note. Settling and failing have their own
 * endpoints because they move money; this one never touches a balance, so a
 * settled payout cannot be edited here.
 */
export const PATCH = withRoute(async (request: Request, { params }: Params) => {
  const admin = await requireFullAdmin();
  const { id } = await params;
  const body = await readBody(request, updatePayoutSchema);

  const existing = await prisma.payout.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Payout");
  if (existing.status === "COMPLETED") {
    throw ApiError.conflict(
      "A settled payout cannot be changed. Adjust the agent's balance instead.",
    );
  }
  if (body.status === "COMPLETED") {
    throw ApiError.badRequest(
      "Use POST /api/admin/payouts/:id/settle so the agent is credited",
    );
  }

  if (body.agentId) {
    const agent = await prisma.agent.findUnique({
      where: { id: body.agentId },
      select: { id: true },
    });
    if (!agent) throw ApiError.notFound("Agent");
  }

  const payout = await prisma.payout.update({
    where: { id },
    data: {
      status: body.status,
      note: body.note,
      ...(body.agentId === undefined ? {} : { agentId: body.agentId }),
      // Releasing a payout back to the pool clears who had taken it.
      ...(body.status === "OPEN" ? { agentId: null, acceptedAt: null } : {}),
    },
    include: {
      agent: { select: { id: true, name: true, mobile: true, status: true } },
    },
  });

  await writeAudit({
    adminId: admin.id,
    action: "payout.update",
    entity: "Payout",
    entityId: id,
    summary: `Updated payout ${payout.reference}`,
    meta: {
      previousStatus: existing.status,
      status: payout.status,
      agentId: payout.agentId,
    },
  });

  return ok(adminPayout(payout));
});

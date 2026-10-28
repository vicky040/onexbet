import { requireAdmin, requireSuperAdmin, revokeAllRefreshTokens } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { ok, readBody, withRoute } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import {
  adminAgent,
  adminBankAccount,
  adminDeposit,
  adminPayin,
  adminPayout,
} from "@/lib/admin-serializers";
import { agentEarnings, agentSummary } from "@/lib/stats";
import { updateAgentSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** The agent plus their recent activity — the agent detail screen. */
export const GET = withRoute(async (_request: Request, { params }: Params) => {
  await requireAdmin();
  const { id } = await params;

  const agent = await prisma.agent.findUnique({
    where: { id },
    include: {
      _count: {
        select: { payins: true, payouts: true, deposits: true, bankAccounts: true },
      },
    },
  });
  if (!agent) throw ApiError.notFound("Agent");

  const [summary, earnings, banks, payins, payouts, deposits] = await Promise.all([
    agentSummary(agent),
    agentEarnings(agent.id, 8),
    prisma.bankAccount.findMany({
      where: { agentId: id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.payin.findMany({
      where: { agentId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
    }),
    prisma.payout.findMany({
      where: { agentId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
    }),
    prisma.deposit.findMany({
      where: { agentId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
    }),
  ]);

  return ok({
    agent: adminAgent(agent),
    summary,
    earnings,
    bankAccounts: banks.map(adminBankAccount),
    payins: payins.map(adminPayin),
    payouts: payouts.map(adminPayout),
    deposits: deposits.map(adminDeposit),
  });
});

/**
 * Updates profile fields, commission rates, status or password. Balance is
 * deliberately not editable here — use POST /agents/:id/balance, which
 * records a reason and an audit entry.
 */
export const PATCH = withRoute(async (request: Request, { params }: Params) => {
  const admin = await requireSuperAdmin();
  const { id } = await params;
  const body = await readBody(request, updateAgentSchema);

  const existing = await prisma.agent.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Agent");

  const agent = await prisma.agent.update({
    where: { id },
    data: {
      name: body.name,
      email: body.email,
      status: body.status,
      payinCommissionRate: body.payinCommissionRate,
      payoutCommissionRate: body.payoutCommissionRate,
      securityDepositUsdt: body.securityDepositUsdt,
      notes: body.notes,
      ...(body.password
        ? { passwordHash: await hashPassword(body.password) }
        : {}),
    },
  });

  // Blocking an agent, or resetting their password, ends their sessions.
  if (body.password || (body.status && body.status !== "ACTIVE")) {
    await revokeAllRefreshTokens(id);
  }

  const changed = Object.keys(body).filter(
    (key) => body[key as keyof typeof body] !== undefined,
  );

  await writeAudit({
    adminId: admin.id,
    action: body.status && body.status !== existing.status
      ? `agent.${body.status.toLowerCase()}`
      : "agent.update",
    entity: "Agent",
    entityId: id,
    summary:
      body.status && body.status !== existing.status
        ? `Set ${agent.name} to ${body.status}`
        : `Updated ${agent.name} (${changed.join(", ")})`,
    meta: { fields: changed, previousStatus: existing.status },
  });

  return ok(adminAgent(agent));
});

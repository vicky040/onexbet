import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, pageMeta, readBody, readPagination, withRoute } from "@/lib/http";
import { createPayout } from "@/lib/operations";
import { adminPayout } from "@/lib/admin-serializers";
import { toNumber } from "@/lib/money";
import { createPayoutSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const PAYOUT_STATUSES = [
  "OPEN",
  "ACCEPTED",
  "PAYMENT_RECEIVED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

/** `?status=`, `?agentId=`, `?q=` (reference or UPI). */
export const GET = withRoute(async (request: Request) => {
  await requireAdmin();
  const url = new URL(request.url);
  const page = readPagination(url);

  const status = url.searchParams.get("status")?.toUpperCase();
  const agentId = url.searchParams.get("agentId") || undefined;
  const q = url.searchParams.get("q")?.trim();

  const where: Prisma.PayoutWhereInput = {
    ...(status && PAYOUT_STATUSES.includes(status)
      ? { status: status as Prisma.PayoutWhereInput["status"] }
      : {}),
    ...(agentId ? { agentId } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" as const } },
            { upiId: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [payouts, total, open, awaiting] = await Promise.all([
    prisma.payout.findMany({
      where,
      include: {
        agent: { select: { id: true, name: true, mobile: true, status: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: page.skip,
      take: page.take,
    }),
    prisma.payout.count({ where }),
    prisma.payout.aggregate({
      where: { status: "OPEN" },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.payout.count({ where: { status: "PAYMENT_RECEIVED" } }),
  ]);

  return ok(payouts.map(adminPayout), {
    meta: {
      ...pageMeta(page, total),
      openCount: open._count._all,
      openAmount: toNumber(open._sum.amount),
      awaitingConfirmation: awaiting,
    },
  });
});

/** Creates a payout — assigned to one agent, or open to all when agentId is omitted. */
export const POST = withRoute(async (request: Request) => {
  const admin = await requireAdmin();
  const body = await readBody(request, createPayoutSchema);

  const payout = await createPayout({
    amount: body.amount,
    upiId: body.upiId,
    agentId: body.agentId,
    commissionRate: body.commissionRate,
    note: body.note,
    adminId: admin.id,
  });

  return ok(adminPayout(payout), { status: 201 });
});

import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, pageMeta, readBody, readPagination, withRoute } from "@/lib/http";
import { recordPayin } from "@/lib/operations";
import { adminPayin } from "@/lib/admin-serializers";
import { toNumber } from "@/lib/money";
import { createPayinSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** `?agentId=`, `?q=` (reference or player txn ref). */
export const GET = withRoute(async (request: Request) => {
  await requireAdmin();
  const url = new URL(request.url);
  const page = readPagination(url);

  const agentId = url.searchParams.get("agentId") || undefined;
  const q = url.searchParams.get("q")?.trim();

  const where: Prisma.PayinWhereInput = {
    ...(agentId ? { agentId } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" as const } },
            { txnRef: { contains: q } },
          ],
        }
      : {}),
  };

  const [payins, total, totals] = await Promise.all([
    prisma.payin.findMany({
      where,
      include: {
        agent: { select: { id: true, name: true, mobile: true, status: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: page.skip,
      take: page.take,
    }),
    prisma.payin.count({ where }),
    prisma.payin.aggregate({ where, _sum: { amount: true, commission: true } }),
  ]);

  return ok(payins.map(adminPayin), {
    meta: {
      ...pageMeta(page, total),
      volume: toNumber(totals._sum.amount),
      commission: toNumber(totals._sum.commission),
    },
  });
});

/**
 * Records a payin against an agent: their float drops by the amount and the
 * commission is credited. Refused if it would take the balance below zero.
 */
export const POST = withRoute(async (request: Request) => {
  const admin = await requireAdmin();
  const body = await readBody(request, createPayinSchema);

  const payin = await recordPayin({
    agentId: body.agentId,
    amount: body.amount,
    txnRef: body.txnRef,
    bankAccountId: body.bankAccountId,
    commissionRate: body.commissionRate,
    adminId: admin.id,
  });

  return ok(adminPayin(payin), { status: 201 });
});

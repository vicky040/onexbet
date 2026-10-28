import type { Prisma } from "@prisma/client";
import { requireFullAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, pageMeta, readPagination, withRoute } from "@/lib/http";
import { adminDeposit } from "@/lib/admin-serializers";
import { toNumber } from "@/lib/money";

export const dynamic = "force-dynamic";

/** `?status=PENDING|COMPLETED|FAILED`, `?agentId=`, `?q=` (UTR or reference). */
export const GET = withRoute(async (request: Request) => {
  await requireFullAdmin();
  const url = new URL(request.url);
  const page = readPagination(url);

  const status = url.searchParams.get("status")?.toUpperCase();
  const agentId = url.searchParams.get("agentId") || undefined;
  const q = url.searchParams.get("q")?.trim();

  const where: Prisma.DepositWhereInput = {
    ...(status && ["PENDING", "COMPLETED", "FAILED"].includes(status)
      ? { status: status as Prisma.DepositWhereInput["status"] }
      : {}),
    ...(agentId ? { agentId } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" as const } },
            { utr: { contains: q } },
          ],
        }
      : {}),
  };

  const [deposits, total, pending] = await Promise.all([
    prisma.deposit.findMany({
      where,
      include: {
        agent: { select: { id: true, name: true, mobile: true, status: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: page.skip,
      take: page.take,
    }),
    prisma.deposit.count({ where }),
    prisma.deposit.aggregate({
      where: { status: "PENDING" },
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  return ok(deposits.map(adminDeposit), {
    meta: {
      ...pageMeta(page, total),
      pendingCount: pending._count._all,
      pendingAmount: toNumber(pending._sum.amount),
    },
  });
});

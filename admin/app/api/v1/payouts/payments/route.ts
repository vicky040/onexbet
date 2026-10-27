import { z } from "zod";
import { requireAgent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, pageMeta, readPagination, withRoute } from "@/lib/http";
import { serializePayoutPayment } from "@/lib/serializers";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const statusFilter = z
  .enum(["COMPLETED", "PAYMENT_RECEIVED", "PENDING", "FAILED"])
  .optional();

/** The four-state app filter maps onto the richer payout lifecycle. */
const STATUS_GROUPS: Record<string, Prisma.PayoutWhereInput["status"]> = {
  COMPLETED: "COMPLETED",
  PAYMENT_RECEIVED: "PAYMENT_RECEIVED",
  PENDING: { in: ["ACCEPTED"] },
  FAILED: { in: ["FAILED", "CANCELLED"] },
};

/**
 * Backs WalletRepository.payoutPayments() — "My Payments". Accepts
 * `?status=PENDING|PAYMENT_RECEIVED|COMPLETED|FAILED` for the filter chips.
 */
export const GET = withRoute(async (request: Request) => {
  const agent = await requireAgent(request);
  const url = new URL(request.url);
  const page = readPagination(url, { defaultPerPage: 50 });
  const status = statusFilter.parse(
    url.searchParams.get("status")?.toUpperCase() || undefined,
  );

  const where: Prisma.PayoutWhereInput = {
    agentId: agent.id,
    status: status ? STATUS_GROUPS[status] : { not: "OPEN" },
  };

  const [payouts, total] = await Promise.all([
    prisma.payout.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: page.skip,
      take: page.take,
    }),
    prisma.payout.count({ where }),
  ]);

  return ok(payouts.map(serializePayoutPayment), { meta: pageMeta(page, total) });
});

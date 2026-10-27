import { requireAgent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, pageMeta, readPagination, withRoute } from "@/lib/http";
import { serializePayin } from "@/lib/serializers";

export const dynamic = "force-dynamic";

/** Backs WalletRepository.payins() — the Payin Records list, newest first. */
export const GET = withRoute(async (request: Request) => {
  const agent = await requireAgent(request);
  const url = new URL(request.url);
  const page = readPagination(url, { defaultPerPage: 50 });

  const where = { agentId: agent.id };
  const [records, total] = await Promise.all([
    prisma.payin.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: page.skip,
      take: page.take,
    }),
    prisma.payin.count({ where }),
  ]);

  return ok(records.map(serializePayin), { meta: pageMeta(page, total) });
});

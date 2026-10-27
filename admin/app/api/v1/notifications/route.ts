import { requireAgent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, pageMeta, readPagination, withRoute } from "@/lib/http";
import { serializeNotification } from "@/lib/serializers";

export const dynamic = "force-dynamic";

/** Backs InboxRepository.notifications(). */
export const GET = withRoute(async (request: Request) => {
  const agent = await requireAgent(request);
  const url = new URL(request.url);
  const page = readPagination(url, { defaultPerPage: 50 });

  const where = { agentId: agent.id };
  const [notifications, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: page.skip,
      take: page.take,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, read: false } }),
  ]);

  return ok(notifications.map(serializeNotification), {
    meta: { ...pageMeta(page, total), unread },
  });
});

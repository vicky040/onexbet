import { requireAgent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, withRoute } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Backs InboxRepository.markAllRead(). */
export const POST = withRoute(async (request: Request) => {
  const agent = await requireAgent(request);

  const result = await prisma.notification.updateMany({
    where: { agentId: agent.id, read: false },
    data: { read: true, readAt: new Date() },
  });

  return ok({ markedRead: result.count });
});

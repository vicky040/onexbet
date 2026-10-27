import { requireAgent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { ok, withRoute } from "@/lib/http";
import { serializeNotification } from "@/lib/serializers";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Backs InboxRepository.markRead(). */
export const POST = withRoute(async (request: Request, { params }: Params) => {
  const agent = await requireAgent(request);
  const { id } = await params;

  const updated = await prisma.notification.updateMany({
    where: { id, agentId: agent.id },
    data: { read: true, readAt: new Date() },
  });
  if (updated.count === 0) throw ApiError.notFound("Notification");

  const notification = await prisma.notification.findUniqueOrThrow({
    where: { id },
  });
  return ok(serializeNotification(notification));
});

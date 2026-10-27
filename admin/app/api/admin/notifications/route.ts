import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, pageMeta, readBody, readPagination, withRoute } from "@/lib/http";
import { sendNotification } from "@/lib/operations";
import { agentRef } from "@/lib/admin-serializers";
import { sendNotificationSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Everything sent, newest first. `?agentId=` narrows to one agent. */
export const GET = withRoute(async (request: Request) => {
  await requireAdmin();
  const url = new URL(request.url);
  const page = readPagination(url);
  const agentId = url.searchParams.get("agentId") || undefined;

  const where: Prisma.NotificationWhereInput = agentId ? { agentId } : {};

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      include: {
        agent: { select: { id: true, name: true, mobile: true, status: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: page.skip,
      take: page.take,
    }),
    prisma.notification.count({ where }),
  ]);

  return ok(
    notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      read: notification.read,
      agent: agentRef(notification.agent),
      broadcastId: notification.broadcastId,
      createdAt: notification.createdAt.toISOString(),
    })),
    { meta: pageMeta(page, total) },
  );
});

/** Sends to one agent, or to every active agent when `broadcast` is true. */
export const POST = withRoute(async (request: Request) => {
  const admin = await requireAdmin();
  const body = await readBody(request, sendNotificationSchema);

  const result = await sendNotification({
    title: body.title,
    body: body.body,
    agentId: body.agentId,
    broadcast: body.broadcast,
    adminId: admin.id,
  });

  return ok(result, { status: 201 });
});

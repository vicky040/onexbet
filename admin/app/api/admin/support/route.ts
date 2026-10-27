import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, withRoute } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * One row per agent who has a support thread: the last message, and how many
 * of their messages nobody has read yet. Threads with unread agent messages
 * come first.
 */
export const GET = withRoute(async () => {
  await requireAdmin();

  const [threads, unreadCounts] = await Promise.all([
    prisma.supportMessage.groupBy({
      by: ["agentId"],
      _max: { createdAt: true },
      _count: { _all: true },
    }),
    prisma.supportMessage.groupBy({
      by: ["agentId"],
      where: { fromAgent: true, readByAdmin: false },
      _count: { _all: true },
    }),
  ]);

  if (threads.length === 0) return ok([]);

  const agentIds = threads.map((thread) => thread.agentId);
  const [agents, lastMessages] = await Promise.all([
    prisma.agent.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true, mobile: true, status: true },
    }),
    prisma.supportMessage.findMany({
      where: {
        createdAt: {
          in: threads
            .map((thread) => thread._max.createdAt)
            .filter((date): date is Date => date !== null),
        },
        agentId: { in: agentIds },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
  ]);

  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const unreadByAgent = new Map(
    unreadCounts.map((row) => [row.agentId, row._count._all]),
  );
  const lastByAgent = new Map<string, (typeof lastMessages)[number]>();
  for (const message of lastMessages) {
    if (!lastByAgent.has(message.agentId)) lastByAgent.set(message.agentId, message);
  }

  const rows = threads
    .map((thread) => {
      const agent = agentById.get(thread.agentId);
      const last = lastByAgent.get(thread.agentId);
      return {
        agent: agent ?? null,
        messageCount: thread._count._all,
        unread: unreadByAgent.get(thread.agentId) ?? 0,
        lastMessageAt: thread._max.createdAt?.toISOString() ?? null,
        lastMessage: last
          ? { text: last.text, fromAgent: last.fromAgent }
          : null,
      };
    })
    .filter((row) => row.agent !== null)
    .sort((a, b) => {
      if (a.unread !== b.unread) return b.unread - a.unread;
      return (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "");
    });

  return ok(rows);
});

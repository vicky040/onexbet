import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge, DateTime, EmptyState, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";

export const metadata = { title: "Support · 1XBET Agent Admin" };

export default async function SupportPage() {
  const [threads, unread] = await Promise.all([
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

  const agents = await prisma.agent.findMany({
    where: { id: { in: threads.map((thread) => thread.agentId) } },
    select: { id: true, name: true, mobile: true, status: true },
  });

  const lastMessages = await prisma.supportMessage.findMany({
    where: { agentId: { in: threads.map((thread) => thread.agentId) } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  const lastByAgent = new Map<string, (typeof lastMessages)[number]>();
  for (const message of lastMessages) {
    if (!lastByAgent.has(message.agentId)) lastByAgent.set(message.agentId, message);
  }

  const unreadByAgent = new Map(
    unread.map((row) => [row.agentId, row._count._all]),
  );
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));

  const rows = threads
    .map((thread) => ({
      agent: agentById.get(thread.agentId),
      messageCount: thread._count._all,
      unread: unreadByAgent.get(thread.agentId) ?? 0,
      lastMessageAt: thread._max.createdAt,
      last: lastByAgent.get(thread.agentId),
    }))
    .filter((row) => row.agent)
    .sort((a, b) => {
      if (a.unread !== b.unread) return b.unread - a.unread;
      return (
        (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0)
      );
    });

  return (
    <>
      <AutoRefresh seconds={15} />
      <PageHeader
        title="Support"
        subtitle="Conversations from the app's chat screen. Unanswered threads come first."
      />

      {rows.length === 0 ? (
        <EmptyState>No agent has started a conversation yet.</EmptyState>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Link
              key={row.agent!.id}
              href={`/support/${row.agent!.id}`}
              className="card block px-5 py-4 transition hover:border-sky"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-navy">
                    {row.agent!.name}
                    <span className="tabular ml-2 text-xs font-normal text-muted">
                      +91 {row.agent!.mobile}
                    </span>
                  </p>
                  <p className="mt-1 max-w-2xl truncate text-sm text-muted">
                    {row.last ? (
                      <>
                        <span className="font-medium text-ink">
                          {row.last.fromAgent ? "Agent" : "Support"}:
                        </span>{" "}
                        {row.last.text}
                      </>
                    ) : (
                      "No messages"
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {row.unread > 0 ? (
                    <Badge tone="warning">{row.unread} unanswered</Badge>
                  ) : (
                    <Badge tone="success">Up to date</Badge>
                  )}
                  <span className="text-xs text-muted">
                    {row.messageCount} msgs
                  </span>
                  <DateTime value={row.lastMessageAt} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

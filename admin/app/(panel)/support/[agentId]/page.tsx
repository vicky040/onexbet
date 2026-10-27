import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { replySupportAction } from "@/app/actions";
import { ActionForm, SubmitButton, Textarea } from "@/components/form";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatInr } from "@/lib/money";

type Params = { params: Promise<{ agentId: string }> };

export async function generateMetadata({ params }: Params) {
  const { agentId } = await params;
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { name: true },
  });
  return { title: `${agent?.name ?? "Support"} · Support · 1XBET Agent Admin` };
}

export default async function SupportThreadPage({ params }: Params) {
  const { agentId } = await params;

  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) notFound();

  const messages = await prisma.supportMessage.findMany({
    where: { agentId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  // Opening the thread counts as reading it.
  await prisma.supportMessage.updateMany({
    where: { agentId, fromAgent: true, readByAdmin: false },
    data: { readByAdmin: true },
  });

  return (
    <>
      <PageHeader
        title={agent.name}
        subtitle={`+91 ${agent.mobile} · balance ${formatInr(agent.balance.toString())}`}
        actions={
          <>
            <StatusBadge status={agent.status} />
            <Link
              href={`/agents/${agent.id}`}
              className="text-xs font-semibold text-sky hover:underline"
            >
              Agent profile
            </Link>
            <Link
              href="/support"
              className="text-xs font-semibold text-muted hover:text-navy hover:underline"
            >
              ← All threads
            </Link>
          </>
        }
      />

      <Card bodyClassName="p-5">
        <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <p className="text-sm text-muted">No messages in this thread yet.</p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={clsx(
                  "flex",
                  message.fromAgent ? "justify-start" : "justify-end",
                )}
              >
                <div
                  className={clsx(
                    "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                    message.fromAgent
                      ? "rounded-bl-sm bg-inset text-ink"
                      : "rounded-br-sm bg-navy text-white",
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  <p
                    className={clsx(
                      "tabular mt-1 text-[11px]",
                      message.fromAgent ? "text-muted" : "text-white/60",
                    )}
                  >
                    {message.fromAgent ? "Agent" : "Support"} ·{" "}
                    {message.createdAt.toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-5 border-t border-line pt-5">
          <ActionForm
            action={replySupportAction}
            resetOnSuccess
            className="space-y-3"
          >
            <input type="hidden" name="agentId" value={agent.id} />
            <Textarea
              label="Reply as support"
              name="text"
              required
              rows={3}
              maxLength={2000}
              placeholder="Type your reply…"
            />
            <SubmitButton>Send reply</SubmitButton>
          </ActionForm>
        </div>
      </Card>
    </>
  );
}

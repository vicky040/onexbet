import type { Prisma } from "@prisma/client";
import { sendNotificationAction } from "@/app/actions";
import { DataTable, type Column } from "@/components/data-table";
import {
  ActionForm,
  Checkbox,
  Field,
  Select,
  SubmitButton,
  Textarea,
} from "@/components/form";
import {
  AgentCell,
  Badge,
  Card,
  DateTime,
  PageHeader,
  Pagination,
} from "@/components/ui";
import { prisma } from "@/lib/db";

export const metadata = { title: "Notifications · 1XBET Agent Admin" };

const PER_PAGE = 30;

type Notice = Prisma.NotificationGetPayload<{
  include: {
    agent: { select: { id: true; name: true; mobile: true; status: true } };
  };
}>;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const [notifications, total, agents] = await Promise.all([
    prisma.notification.findMany({
      include: {
        agent: { select: { id: true, name: true, mobile: true, status: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.notification.count(),
    prisma.agent.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, mobile: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const columns: Column<Notice>[] = [
    {
      header: "Notification",
      primary: true,
      cell: (notice) => (
        <div>
          <span className="block font-medium text-ink">{notice.title}</span>
          <span className="block text-xs text-muted">{notice.body}</span>
          {notice.broadcastId ? (
            <span className="mt-1 inline-block text-[11px] font-semibold uppercase tracking-wide text-sky">
              Broadcast
            </span>
          ) : null}
        </div>
      ),
    },
    { header: "Agent", cell: (notice) => <AgentCell agent={notice.agent} /> },
    {
      header: "Read",
      cell: (notice) =>
        notice.read ? (
          <Badge tone="success">Read</Badge>
        ) : (
          <Badge tone="warning">Unread</Badge>
        ),
    },
    { header: "Sent", cell: (notice) => <DateTime value={notice.createdAt} /> },
  ];

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Messages that appear in the app's notification bell."
      />

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <Card
          title="Send a notification"
          description="Deposit approvals and payout updates are already sent automatically."
        >
          <ActionForm
            action={sendNotificationAction}
            resetOnSuccess
            className="space-y-4"
          >
            <Field
              label="Title"
              name="title"
              required
              maxLength={120}
              placeholder="Scheduled maintenance"
            />
            <Textarea
              label="Message"
              name="body"
              required
              rows={4}
              maxLength={1000}
              placeholder="What agents need to know."
            />
            <Select label="Send to" name="agentId" defaultValue="">
              <option value="">Choose one agent…</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} (+91 {agent.mobile})
                </option>
              ))}
            </Select>
            <Checkbox
              name="broadcast"
              label="Send to every active agent"
              hint="Overrides the agent chosen above."
            />
            <SubmitButton>Send</SubmitButton>
          </ActionForm>
        </Card>

        <Card title="Sent" bodyClassName="p-5">
          <DataTable
            columns={columns}
            rows={notifications}
            rowKey={(notice) => notice.id}
            empty="Nothing has been sent yet."
          />

          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(total / PER_PAGE))}
            total={total}
            query={{}}
            basePath="/notifications"
          />
        </Card>
      </div>
    </>
  );
}

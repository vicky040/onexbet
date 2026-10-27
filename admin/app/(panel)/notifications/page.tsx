import { sendNotificationAction } from "@/app/actions";
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
  Table,
  Td,
} from "@/components/ui";
import { prisma } from "@/lib/db";

export const metadata = { title: "Notifications · 1XBET Agent Admin" };

const PER_PAGE = 30;

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
          <Table
            head={["Notification", "Agent", "Read", "Sent"]}
            empty="Nothing has been sent yet."
          >
            {notifications.map((notification) => (
              <tr key={notification.id} className="hover:bg-inset/60">
                <Td>
                  <span className="font-medium text-ink">{notification.title}</span>
                  <span className="block max-w-md text-xs text-muted">
                    {notification.body}
                  </span>
                  {notification.broadcastId ? (
                    <span className="mt-1 inline-block text-[11px] font-semibold uppercase tracking-wide text-sky">
                      Broadcast
                    </span>
                  ) : null}
                </Td>
                <Td>
                  <AgentCell agent={notification.agent} />
                </Td>
                <Td>
                  {notification.read ? (
                    <Badge tone="success">Read</Badge>
                  ) : (
                    <Badge tone="warning">Unread</Badge>
                  )}
                </Td>
                <Td>
                  <DateTime value={notification.createdAt} />
                </Td>
              </tr>
            ))}
          </Table>

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

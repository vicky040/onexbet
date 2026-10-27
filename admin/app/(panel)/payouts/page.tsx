import type { Prisma } from "@prisma/client";
import {
  createPayoutAction,
  failPayoutAction,
  releasePayoutAction,
  settlePayoutAction,
} from "@/app/actions";
import {
  ActionForm,
  Disclosure,
  Field,
  Select,
  SubmitButton,
  Textarea,
} from "@/components/form";
import {
  AgentCell,
  Card,
  DateTime,
  FilterBar,
  Money,
  PageHeader,
  Pagination,
  Reference,
  StatTile,
  StatusBadge,
  Table,
  Td,
} from "@/components/ui";
import { getSettings, prisma } from "@/lib/db";
import { formatInr, toNumber } from "@/lib/money";

export const metadata = { title: "Payouts · 1XBET Agent Admin" };

const PER_PAGE = 25;

const STATUSES = [
  "OPEN",
  "ACCEPTED",
  "PAYMENT_RECEIVED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    agentId?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const status = params.status?.toUpperCase();
  const q = params.q?.trim();

  const where: Prisma.PayoutWhereInput = {
    ...(status && STATUSES.includes(status)
      ? { status: status as Prisma.PayoutWhereInput["status"] }
      : {}),
    ...(params.agentId ? { agentId: params.agentId } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" } },
            { upiId: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [payouts, total, open, awaiting, settled, agents, settings] =
    await Promise.all([
      prisma.payout.findMany({
        where,
        include: {
          agent: { select: { id: true, name: true, mobile: true, status: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * PER_PAGE,
        take: PER_PAGE,
      }),
      prisma.payout.count({ where }),
      prisma.payout.aggregate({
        where: { status: "OPEN" },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.payout.count({ where: { status: "PAYMENT_RECEIVED" } }),
      prisma.payout.aggregate({
        where: { status: "COMPLETED" },
        _count: { _all: true },
        _sum: { amount: true, commission: true },
      }),
      prisma.agent.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true, mobile: true },
        orderBy: { name: "asc" },
      }),
      getSettings(),
    ]);

  return (
    <>
      <PageHeader
        title="Payouts"
        subtitle="Money agents send to players. Settling credits them the amount plus commission."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Open to claim"
          value={`${open._count._all}`}
          hint={formatInr(toNumber(open._sum.amount))}
        />
        <StatTile
          tone={awaiting > 0 ? "warning" : "default"}
          label="Awaiting confirmation"
          value={`${awaiting}`}
          hint="Agent reports they have paid"
        />
        <StatTile
          label="Settled"
          value={`${settled._count._all}`}
          hint={`${formatInr(toNumber(settled._sum.amount))} · ${formatInr(
            toNumber(settled._sum.commission),
          )} commission`}
        />
      </div>

      <div className="mt-6 mb-6">
        <Disclosure summary="Create a payout">
          <ActionForm
            action={createPayoutAction}
            resetOnSuccess
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
              />
              <Field
                label="Pay to UPI"
                name="upiId"
                required
                placeholder="player@bank"
              />
              <Select label="Assign to" name="agentId" defaultValue="">
                <option value="">Open to every active agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} (+91 {agent.mobile})
                  </option>
                ))}
              </Select>
              <Field
                label="Commission %"
                name="commissionRate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder={settings.defaultPayoutCommissionRate.toString()}
                hint="Blank uses the agent's own rate, or the default"
              />
            </div>
            <Textarea label="Note for the agent" name="note" rows={2} />
            <SubmitButton>Create payout</SubmitButton>
          </ActionForm>
        </Disclosure>
      </div>

      <Card bodyClassName="p-5">
        <FilterBar reset="/payouts">
          <label className="block">
            <span className="label">Search</span>
            <input
              className="field sm:w-64"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Reference or UPI"
            />
          </label>
          <label className="block">
            <span className="label">Status</span>
            <select
              className="field sm:w-48"
              name="status"
              defaultValue={status ?? ""}
            >
              <option value="">All</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value.replace(/_/g, " ").toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          {params.agentId ? (
            <input type="hidden" name="agentId" value={params.agentId} />
          ) : null}
        </FilterBar>

        <Table
          head={["Reference", "Agent", "Amount", "Pay to", "Status", "When", ""]}
          empty="No payouts match this filter."
        >
          {payouts.map((payout) => (
            <tr key={payout.id} className="hover:bg-inset/60">
              <Td>
                <Reference>{payout.reference}</Reference>
                {payout.note ? (
                  <span className="block max-w-48 truncate text-xs text-muted">
                    {payout.note}
                  </span>
                ) : null}
              </Td>
              <Td>
                <AgentCell agent={payout.agent} />
              </Td>
              <Td numeric>
                <Money value={payout.amount.toString()} />
                <span className="block text-xs text-success">
                  +{formatInr(payout.commission.toString())}
                </span>
              </Td>
              <Td>
                <span className="text-xs text-muted">{payout.upiId}</span>
              </Td>
              <Td>
                <StatusBadge status={payout.status} />
              </Td>
              <Td>
                <DateTime value={payout.createdAt} />
              </Td>
              <Td>
                <div className="flex flex-wrap justify-end gap-2">
                  {(payout.status === "PAYMENT_RECEIVED" ||
                    payout.status === "ACCEPTED") &&
                  payout.agentId ? (
                    <ActionForm
                      action={settlePayoutAction}
                      hideMessage
                      confirm={`Settle ${payout.reference} and credit ${formatInr(
                        payout.amount.add(payout.commission).toString(),
                      )}?`}
                    >
                      <input type="hidden" name="payoutId" value={payout.id} />
                      <SubmitButton variant="success" size="sm">
                        Settle
                      </SubmitButton>
                    </ActionForm>
                  ) : null}

                  {payout.status !== "COMPLETED" && payout.status !== "FAILED" ? (
                    <ActionForm
                      action={failPayoutAction}
                      hideMessage
                      confirm={`Mark ${payout.reference} failed?`}
                    >
                      <input type="hidden" name="payoutId" value={payout.id} />
                      <SubmitButton variant="secondary" size="sm">
                        Fail
                      </SubmitButton>
                    </ActionForm>
                  ) : null}

                  {payout.agentId && payout.status !== "COMPLETED" ? (
                    <ActionForm
                      action={releasePayoutAction}
                      hideMessage
                      confirm={`Release ${payout.reference} back to the pool?`}
                    >
                      <input type="hidden" name="payoutId" value={payout.id} />
                      <SubmitButton variant="ghost" size="sm">
                        Release
                      </SubmitButton>
                    </ActionForm>
                  ) : null}
                </div>
              </Td>
            </tr>
          ))}
        </Table>

        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / PER_PAGE))}
          total={total}
          query={{ q, status, agentId: params.agentId }}
          basePath="/payouts"
        />
      </Card>
    </>
  );
}

import Link from "next/link";
import type { Prisma } from "@prisma/client";
import {
  createPayoutAction,
  failPayoutAction,
  releasePayoutAction,
  settlePayoutAction,
  updatePayoutAmountsAction,
} from "@/app/actions";
import { DataTable, type Column } from "@/components/data-table";
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
} from "@/components/ui";
import { isSuperAdmin } from "@/lib/auth";
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

type Payout = Prisma.PayoutGetPayload<{
  include: {
    agent: { select: { id: true; name: true; mobile: true; status: true } };
  };
}>;

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    agentId?: string;
    page?: string;
    correct?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const status = params.status?.toUpperCase();
  const q = params.q?.trim();
  const superAdmin = await isSuperAdmin();

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

  const [payouts, total, open, awaiting, settled, agents, settings, correcting] =
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
      superAdmin && params.correct
        ? prisma.payout.findUnique({ where: { id: params.correct } })
        : null,
    ]);

  const columns: Column<Payout>[] = [
    {
      header: "Reference",
      primary: true,
      cell: (payout) => (
        <div>
          <Reference>{payout.reference}</Reference>
          {payout.note ? (
            <span className="block truncate text-xs text-muted">{payout.note}</span>
          ) : null}
        </div>
      ),
    },
    { header: "Agent", cell: (payout) => <AgentCell agent={payout.agent} /> },
    {
      header: "Amount",
      numeric: true,
      cell: (payout) => (
        <div>
          <Money value={payout.amount.toString()} />
          <span className="block text-xs text-success">
            +{formatInr(payout.commission.toString())}
          </span>
        </div>
      ),
    },
    {
      header: "Pay to",
      cell: (payout) => <span className="text-xs text-muted">{payout.upiId}</span>,
    },
    { header: "Status", cell: (payout) => <StatusBadge status={payout.status} /> },
    { header: "Created", cell: (payout) => <DateTime value={payout.createdAt} /> },
    {
      header: "",
      actions: true,
      cell: (payout) => (
        <>
          {(payout.status === "PAYMENT_RECEIVED" || payout.status === "ACCEPTED") &&
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

          {superAdmin ? (
            <Link
              href={`/payouts?correct=${payout.id}`}
              className="px-2 py-1.5 text-xs font-semibold text-sky hover:underline"
            >
              Correct
            </Link>
          ) : null}
        </>
      ),
    },
  ];

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

      {correcting ? (
        <div className="mt-6">
          <Card
            title={`Correct ${correcting.reference}`}
            description={
              correcting.status === "COMPLETED"
                ? "This payout is settled, so the difference will be applied to the agent's balance."
                : "This payout has not been settled, so no balance moves."
            }
            actions={
              <Link
                href="/payouts"
                className="text-xs font-semibold text-muted hover:text-navy hover:underline"
              >
                Cancel
              </Link>
            }
          >
            <ActionForm
              action={updatePayoutAmountsAction}
              className="space-y-4"
              confirm="Apply this correction?"
            >
              <input type="hidden" name="payoutId" value={correcting.id} />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  label="Amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue={correcting.amount.toString()}
                />
                <Field
                  label="Commission %"
                  name="commissionRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue={correcting.commissionRate.toString()}
                />
                <Field
                  label="Pay to UPI"
                  name="upiId"
                  defaultValue={correcting.upiId}
                />
              </div>
              <Textarea
                label="Reason"
                name="reason"
                required
                rows={2}
                placeholder="Why this record is being corrected"
              />
              <SubmitButton>Apply correction</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      ) : null}

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

        <DataTable
          columns={columns}
          rows={payouts}
          rowKey={(payout) => payout.id}
          empty="No payouts match this filter."
          minWidth="52rem"
        />

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

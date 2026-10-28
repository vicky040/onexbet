import Link from "next/link";
import type { Prisma } from "@prisma/client";
import {
  approveDepositAction,
  failPayoutAction,
  rejectDepositAction,
  settlePayoutAction,
} from "@/app/actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { DataTable, type Column } from "@/components/data-table";
import { ActionForm, SubmitButton } from "@/components/form";
import {
  AgentCell,
  Card,
  DateTime,
  Money,
  PageHeader,
  Reference,
  StatTile,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatInr, formatPercent } from "@/lib/money";
import { platformOverview } from "@/lib/stats";

export const metadata = { title: "Dashboard · 1XBET Agent Admin" };

const agentSelect = {
  select: { id: true, name: true, mobile: true, status: true },
} as const;

type Deposit = Prisma.DepositGetPayload<{ include: { agent: typeof agentSelect } }>;
type Payout = Prisma.PayoutGetPayload<{ include: { agent: typeof agentSelect } }>;
type Payin = Prisma.PayinGetPayload<{ include: { agent: typeof agentSelect } }>;

export default async function DashboardPage() {
  const [overview, pendingDeposits, reportedPayouts, recentPayins] =
    await Promise.all([
      platformOverview(),
      prisma.deposit.findMany({
        where: { status: "PENDING" },
        include: { agent: agentSelect },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 6,
      }),
      prisma.payout.findMany({
        where: { status: "PAYMENT_RECEIVED" },
        include: { agent: agentSelect },
        orderBy: [{ paidAt: "asc" }, { id: "asc" }],
        take: 6,
      }),
      prisma.payin.findMany({
        include: { agent: agentSelect },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 6,
      }),
    ]);

  const depositColumns: Column<Deposit>[] = [
    {
      header: "Reference",
      primary: true,
      cell: (deposit) => <Reference>{deposit.reference}</Reference>,
    },
    { header: "Agent", cell: (deposit) => <AgentCell agent={deposit.agent} /> },
    {
      header: "Amount",
      numeric: true,
      cell: (deposit) => <Money value={deposit.amount.toString()} />,
    },
    {
      header: "UTR",
      cell: (deposit) => (
        <span className="tabular text-xs text-muted">{deposit.utr}</span>
      ),
    },
    {
      header: "Submitted",
      tableOnly: true,
      cell: (deposit) => <DateTime value={deposit.createdAt} />,
    },
    {
      header: "",
      actions: true,
      cell: (deposit) => (
        <>
          <ActionForm
            action={approveDepositAction}
            hideMessage
            confirm={`Approve ${deposit.reference} and credit ${formatInr(
              deposit.amount.toString(),
            )}?`}
          >
            <input type="hidden" name="depositId" value={deposit.id} />
            <SubmitButton variant="success" size="sm">
              Approve
            </SubmitButton>
          </ActionForm>
          <ActionForm
            action={rejectDepositAction}
            hideMessage
            confirm={`Reject ${deposit.reference}?`}
          >
            <input type="hidden" name="depositId" value={deposit.id} />
            <SubmitButton variant="secondary" size="sm">
              Reject
            </SubmitButton>
          </ActionForm>
        </>
      ),
    },
  ];

  const payoutColumns: Column<Payout>[] = [
    {
      header: "Reference",
      primary: true,
      cell: (payout) => <Reference>{payout.reference}</Reference>,
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
    {
      header: "Reported",
      tableOnly: true,
      cell: (payout) => <DateTime value={payout.paidAt} />,
    },
    {
      header: "",
      actions: true,
      cell: (payout) => (
        <>
          <ActionForm
            action={settlePayoutAction}
            hideMessage
            confirm={`Confirm ${payout.reference} and credit the agent ${formatInr(
              payout.amount.add(payout.commission).toString(),
            )}?`}
          >
            <input type="hidden" name="payoutId" value={payout.id} />
            <SubmitButton variant="success" size="sm">
              Settle
            </SubmitButton>
          </ActionForm>
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
        </>
      ),
    },
  ];

  const payinColumns: Column<Payin>[] = [
    {
      header: "Reference",
      primary: true,
      cell: (payin) => <Reference>{payin.reference}</Reference>,
    },
    { header: "Agent", cell: (payin) => <AgentCell agent={payin.agent} /> },
    {
      header: "Amount",
      numeric: true,
      cell: (payin) => <Money value={payin.amount.toString()} />,
    },
    {
      header: "Commission",
      numeric: true,
      cell: (payin) => (
        <Money value={payin.commission.toString()} tone="success" />
      ),
    },
    { header: "When", cell: (payin) => <DateTime value={payin.createdAt} /> },
  ];

  return (
    <>
      <AutoRefresh seconds={20} />
      <PageHeader
        title="Dashboard"
        subtitle="Money waiting on you, and how the network is doing today."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          tone="navy"
          label="Agent float held"
          value={formatInr(overview.balanceHeld)}
          hint={`${overview.agents.active} active of ${overview.agents.total} agents`}
        />
        <StatTile
          tone={overview.deposits.pendingCount > 0 ? "warning" : "default"}
          label="Deposits to review"
          value={`${overview.deposits.pendingCount}`}
          hint={formatInr(overview.deposits.pendingAmount)}
        />
        <StatTile
          label="Open payouts"
          value={`${overview.payouts.openCount}`}
          hint={formatInr(overview.payouts.openAmount)}
        />
        <StatTile
          label="Payins today"
          value={formatInr(overview.payins.todayVolume)}
          hint={`${overview.payins.todayCount} payins · ${formatInr(
            overview.payins.todayCommission,
          )} commission`}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Payin volume (all time)"
          value={formatInr(overview.payins.totalVolume)}
          hint={`${formatInr(overview.payins.totalCommission)} paid in commission`}
        />
        <StatTile
          label="Payout volume"
          value={formatInr(overview.payouts.volume)}
          hint={`${overview.payouts.settledCount} settled`}
        />
        <StatTile
          label="Payout success rate"
          value={formatPercent(overview.payouts.successRate)}
          hint="Received or completed, of all claimed"
        />
        <StatTile
          tone={overview.agents.pending > 0 ? "warning" : "default"}
          label="Agents awaiting approval"
          value={`${overview.agents.pending}`}
          hint={`${overview.agents.blocked} blocked`}
        />
      </div>

      <div className="mt-6 space-y-6">
        <Card
          title="Deposits waiting for review"
          description="Approving credits the agent's balance straight away."
          actions={
            <Link
              href="/deposits"
              className="text-xs font-semibold text-sky hover:underline"
            >
              All deposits →
            </Link>
          }
        >
          <DataTable
            columns={depositColumns}
            rows={pendingDeposits}
            rowKey={(deposit) => deposit.id}
            empty="Nothing to review. The queue is clear."
          />
        </Card>

        <Card
          title="Payouts awaiting confirmation"
          description="The agent says they have paid the player. Settling credits them the amount plus commission."
          actions={
            <Link
              href="/payouts"
              className="text-xs font-semibold text-sky hover:underline"
            >
              All payouts →
            </Link>
          }
        >
          <DataTable
            columns={payoutColumns}
            rows={reportedPayouts}
            rowKey={(payout) => payout.id}
            empty="No payouts are waiting on a confirmation."
          />
        </Card>

        <Card
          title="Latest payins"
          actions={
            <Link
              href="/payins"
              className="text-xs font-semibold text-sky hover:underline"
            >
              All payins →
            </Link>
          }
        >
          <DataTable
            columns={payinColumns}
            rows={recentPayins}
            rowKey={(payin) => payin.id}
            empty="No payins recorded yet."
          />
        </Card>
      </div>
    </>
  );
}

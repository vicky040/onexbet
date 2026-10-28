import Link from "next/link";
import { notFound } from "next/navigation";
import type { BankAccount, Deposit, Payin, Payout } from "@prisma/client";
import {
  adjustBalanceAction,
  toggleBankAction,
  updateAgentAction,
} from "@/app/actions";
import { DataTable, type Column } from "@/components/data-table";
import {
  ActionForm,
  Field,
  Select,
  SubmitButton,
  Textarea,
} from "@/components/form";
import {
  Badge,
  Card,
  DateTime,
  Money,
  PageHeader,
  Reference,
  StatTile,
  StatusBadge,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { adminScope, assertAgentInScope } from "@/lib/scope";
import { formatInr, formatPercent } from "@/lib/money";
import { agentEarnings, agentSummary } from "@/lib/stats";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  const agent = await prisma.agent.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: `${agent?.name ?? "Agent"} · 1XBET Agent Admin` };
}

export default async function AgentDetailPage({ params }: Params) {
  const { id } = await params;

  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent) notFound();

  const scope = await adminScope();
  const superAdmin = scope.admin.role === "SUPER_ADMIN";
  // A master may only look at agents they referred.
  assertAgentInScope(scope, id);

  const [summary, earnings, banks, payins, payouts, deposits] = await Promise.all([
    agentSummary(agent),
    agentEarnings(agent.id, 6),
    prisma.bankAccount.findMany({
      where: { agentId: id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.payin.findMany({
      where: { agentId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
    }),
    prisma.payout.findMany({
      where: { agentId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
    }),
    prisma.deposit.findMany({
      where: { agentId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
    }),
  ]);

  const bankColumns: Column<BankAccount>[] = [
    {
      header: "Bank",
      primary: true,
      cell: (bank) => (
        <div>
          <span className="font-semibold text-ink">{bank.bankName}</span>
          <span className="block text-xs text-muted">{bank.accountHolder}</span>
        </div>
      ),
    },
    {
      header: "Account",
      cell: (bank) => (
        <span className="tabular text-xs text-muted">
          ***{bank.accountNumber.slice(-4)} · {bank.ifsc}
        </span>
      ),
    },
    {
      header: "UPI",
      cell: (bank) => <span className="text-xs text-muted">{bank.upiId}</span>,
    },
    {
      header: "Limits",
      numeric: true,
      cell: (bank) => (
        <span className="text-xs text-muted">
          {formatInr(bank.amountLimit.toString())} · {bank.txnLimit} txns
        </span>
      ),
    },
    {
      header: "Active",
      cell: (bank) =>
        bank.isActive ? <Badge tone="success">Active</Badge> : <Badge>Off</Badge>,
    },
    {
      header: "",
      actions: true,
      cell: (bank) =>
        superAdmin ? (
          <ActionForm action={toggleBankAction} hideMessage>
            <input type="hidden" name="bankId" value={bank.id} />
            <SubmitButton variant="secondary" size="sm">
              {bank.isActive ? "Turn off" : "Turn on"}
            </SubmitButton>
          </ActionForm>
        ) : null,
    },
  ];

  const payinColumns: Column<Payin>[] = [
    {
      header: "Reference",
      primary: true,
      cell: (payin) => (
        <div>
          <Reference>{payin.reference}</Reference>
          <span className="tabular block text-xs text-muted">{payin.txnRef}</span>
        </div>
      ),
    },
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
    {
      header: "After balance",
      numeric: true,
      cell: (payin) => <Money value={payin.afterBalance.toString()} tone="muted" />,
    },
    { header: "When", cell: (payin) => <DateTime value={payin.createdAt} /> },
  ];

  const payoutColumns: Column<Payout>[] = [
    {
      header: "Reference",
      primary: true,
      cell: (payout) => (
        <div>
          <Reference>{payout.reference}</Reference>
          <span className="block text-xs text-muted">{payout.upiId}</span>
        </div>
      ),
    },
    { header: "Status", cell: (payout) => <StatusBadge status={payout.status} /> },
    {
      header: "Amount",
      numeric: true,
      cell: (payout) => <Money value={payout.amount.toString()} />,
    },
    {
      header: "Commission",
      numeric: true,
      cell: (payout) => (
        <Money value={payout.commission.toString()} tone="success" />
      ),
    },
    { header: "When", cell: (payout) => <DateTime value={payout.createdAt} /> },
  ];

  const depositColumns: Column<Deposit>[] = [
    {
      header: "Reference",
      primary: true,
      cell: (deposit) => <Reference>{deposit.reference}</Reference>,
    },
    { header: "Status", cell: (deposit) => <StatusBadge status={deposit.status} /> },
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
    { header: "When", cell: (deposit) => <DateTime value={deposit.createdAt} /> },
  ];

  return (
    <>
      <PageHeader
        title={agent.name}
        subtitle={`+91 ${agent.mobile} · ${agent.email}`}
        actions={
          <>
            <StatusBadge status={agent.status} />
            <Link
              href="/agents"
              className="text-xs font-semibold text-sky hover:underline"
            >
              ← All agents
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          tone="navy"
          label="Balance"
          value={formatInr(summary.totalBalance)}
          hint={
            agent.lastLoginAt
              ? `Last seen ${agent.lastLoginAt.toLocaleDateString("en-IN")}`
              : "Never signed in"
          }
        />
        <StatTile
          label="Payin commission"
          value={formatInr(summary.payinCommission)}
          hint={`${formatInr(summary.totalPayin)} processed`}
        />
        <StatTile
          label="Payout commission"
          value={formatInr(summary.payoutCommission)}
          hint={`${formatInr(summary.payoutsCredited)} credited`}
        />
        <StatTile
          label="Payout success rate"
          value={formatPercent(summary.successRate)}
          hint={`${formatInr(summary.totalDeposit)} deposited · ${summary.securityDepositUsdt.toLocaleString(
            "en-IN",
          )} USDT security`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {superAdmin ? (
          <Card
            title="Profile & commission"
            description="Blocking an agent or changing their password signs them out everywhere."
          >
            <ActionForm action={updateAgentAction} className="space-y-4">
              <input type="hidden" name="agentId" value={agent.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" name="name" defaultValue={agent.name} />
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  defaultValue={agent.email}
                />
                <Select label="Status" name="status" defaultValue={agent.status}>
                  <option value="ACTIVE">Active</option>
                  <option value="PENDING">Pending approval</option>
                  <option value="BLOCKED">Blocked</option>
                </Select>
                <Field
                  label="Security deposit (USDT)"
                  name="securityDepositUsdt"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={agent.securityDepositUsdt.toString()}
                />
                <Field
                  label="Payin commission %"
                  name="payinCommissionRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue={agent.payinCommissionRate.toString()}
                />
                <Field
                  label="Payout commission %"
                  name="payoutCommissionRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue={agent.payoutCommissionRate.toString()}
                />
              </div>
              <Field
                label="Set a new password"
                name="password"
                type="password"
                minLength={6}
                placeholder="Leave blank to keep the current one"
              />
              <Textarea
                label="Internal notes"
                name="notes"
                defaultValue={agent.notes ?? ""}
                rows={2}
              />
              <SubmitButton>Save changes</SubmitButton>
            </ActionForm>
          </Card>
        ) : scope.isMaster ? (
          <Card
            title="Commission rates"
            description="The rates this agent earns. Everything else about them is set by a super admin."
          >
            <ActionForm action={updateAgentAction} className="space-y-4">
              <input type="hidden" name="agentId" value={agent.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Payin commission %"
                  name="payinCommissionRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue={agent.payinCommissionRate.toString()}
                />
                <Field
                  label="Payout commission %"
                  name="payoutCommissionRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue={agent.payoutCommissionRate.toString()}
                />
              </div>
              <SubmitButton>Save commission</SubmitButton>
            </ActionForm>
          </Card>
        ) : (
          <Card title="Profile & commission">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Status</dt>
                <dd>
                  <StatusBadge status={agent.status} />
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Payin commission</dt>
                <dd className="tabular font-semibold">
                  {formatPercent(agent.payinCommissionRate.toString())}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Payout commission</dt>
                <dd className="tabular font-semibold">
                  {formatPercent(agent.payoutCommissionRate.toString())}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Security deposit</dt>
                <dd className="tabular font-semibold">
                  {agent.securityDepositUsdt.toString()} USDT
                </dd>
              </div>
              {agent.notes ? (
                <div className="pt-2">
                  <dt className="text-muted">Notes</dt>
                  <dd className="mt-1">{agent.notes}</dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-4 rounded-lg bg-inset px-3 py-2 text-xs text-muted">
              Changing agent data and commission rates is restricted to super
              admins.
            </p>
          </Card>
        )}

        <Card
          title={superAdmin ? "Adjust balance" : "Weekly earnings"}
          description={
            superAdmin
              ? "For corrections only. Every adjustment is audited and the agent is notified."
              : undefined
          }
        >
          {superAdmin ? (
            <ActionForm
              action={adjustBalanceAction}
              resetOnSuccess
              className="space-y-4"
              confirm="Apply this balance adjustment?"
            >
              <input type="hidden" name="agentId" value={agent.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Direction" name="direction" defaultValue="credit">
                  <option value="credit">Credit (add)</option>
                  <option value="debit">Debit (deduct)</option>
                </Select>
                <Field
                  label="Amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                />
              </div>
              <Textarea
                label="Reason"
                name="reason"
                required
                rows={2}
                placeholder="Why this adjustment is being made"
              />
              <SubmitButton variant="secondary">Apply adjustment</SubmitButton>
            </ActionForm>
          ) : null}

          <div className={superAdmin ? "mt-6 border-t border-line pt-4" : ""}>
            {superAdmin ? <p className="label">Weekly earnings</p> : null}
            {earnings.every((week) => week.netEarnings === 0) ? (
              <p className="text-sm text-muted">No earnings in the last 6 weeks.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {earnings.map((week) => (
                  <li
                    key={week.weekStart}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted">
                      Week {week.week} · {week.transactions} txns
                    </span>
                    <Money value={week.netEarnings} tone="success" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 space-y-6">
        <Card title="Bank accounts" description={`${banks.length} on file`}>
          <DataTable
            columns={bankColumns}
            rows={banks}
            rowKey={(bank) => bank.id}
            empty="This agent has not added a bank account yet."
            minWidth="48rem"
          />
        </Card>

        <Card
          title="Recent payins"
          actions={
            <Link
              href={`/payins?agentId=${agent.id}`}
              className="text-xs font-semibold text-sky hover:underline"
            >
              All →
            </Link>
          }
        >
          <DataTable
            columns={payinColumns}
            rows={payins}
            rowKey={(payin) => payin.id}
            empty="No payins yet."
          />
        </Card>

        <Card
          title="Recent payouts"
          actions={
            <Link
              href={`/payouts?agentId=${agent.id}`}
              className="text-xs font-semibold text-sky hover:underline"
            >
              All →
            </Link>
          }
        >
          <DataTable
            columns={payoutColumns}
            rows={payouts}
            rowKey={(payout) => payout.id}
            empty="No payouts yet."
          />
        </Card>

        <Card
          title="Recent deposits"
          actions={
            <Link
              href={`/deposits?agentId=${agent.id}`}
              className="text-xs font-semibold text-sky hover:underline"
            >
              All →
            </Link>
          }
        >
          <DataTable
            columns={depositColumns}
            rows={deposits}
            rowKey={(deposit) => deposit.id}
            empty="No deposits yet."
          />
        </Card>
      </div>
    </>
  );
}

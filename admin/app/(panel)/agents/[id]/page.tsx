import Link from "next/link";
import { notFound } from "next/navigation";
import {
  adjustBalanceAction,
  toggleBankAction,
  updateAgentAction,
} from "@/app/actions";
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
  EmptyState,
  Money,
  PageHeader,
  Reference,
  StatTile,
  StatusBadge,
  Table,
  Td,
} from "@/components/ui";
import { prisma } from "@/lib/db";
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

        <Card
          title="Adjust balance"
          description="For corrections only. Every adjustment is audited and the agent is notified."
        >
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

          <div className="mt-6 border-t border-line pt-4">
            <p className="label">Weekly earnings</p>
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
          {banks.length === 0 ? (
            <EmptyState>This agent has not added a bank account yet.</EmptyState>
          ) : (
            <Table head={["Bank", "Account", "UPI", "Limits", "Active", ""]}>
              {banks.map((bank) => (
                <tr key={bank.id}>
                  <Td>
                    <span className="font-medium text-ink">{bank.bankName}</span>
                    <span className="block text-xs text-muted">
                      {bank.accountHolder}
                    </span>
                  </Td>
                  <Td>
                    <span className="tabular text-xs text-muted">
                      ***{bank.accountNumber.slice(-4)} · {bank.ifsc}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-xs text-muted">{bank.upiId}</span>
                  </Td>
                  <Td numeric>
                    <span className="text-xs text-muted">
                      {formatInr(bank.amountLimit.toString())} · {bank.txnLimit} txns
                    </span>
                  </Td>
                  <Td>
                    {bank.isActive ? (
                      <Badge tone="success">Active</Badge>
                    ) : (
                      <Badge>Off</Badge>
                    )}
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      <ActionForm action={toggleBankAction} hideMessage>
                        <input type="hidden" name="bankId" value={bank.id} />
                        <SubmitButton variant="secondary" size="sm">
                          {bank.isActive ? "Turn off" : "Turn on"}
                        </SubmitButton>
                      </ActionForm>
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
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
          {payins.length === 0 ? (
            <EmptyState>No payins yet.</EmptyState>
          ) : (
            <Table
              head={["Reference", "Amount", "Commission", "After balance", "When"]}
            >
              {payins.map((payin) => (
                <tr key={payin.id}>
                  <Td>
                    <Reference>{payin.reference}</Reference>
                    <span className="block text-xs text-muted">{payin.txnRef}</span>
                  </Td>
                  <Td numeric>
                    <Money value={payin.amount.toString()} />
                  </Td>
                  <Td numeric>
                    <Money value={payin.commission.toString()} tone="success" />
                  </Td>
                  <Td numeric>
                    <Money value={payin.afterBalance.toString()} tone="muted" />
                  </Td>
                  <Td>
                    <DateTime value={payin.createdAt} />
                  </Td>
                </tr>
              ))}
            </Table>
          )}
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
          {payouts.length === 0 ? (
            <EmptyState>No payouts yet.</EmptyState>
          ) : (
            <Table head={["Reference", "Status", "Amount", "Commission", "When"]}>
              {payouts.map((payout) => (
                <tr key={payout.id}>
                  <Td>
                    <Reference>{payout.reference}</Reference>
                    <span className="block text-xs text-muted">{payout.upiId}</span>
                  </Td>
                  <Td>
                    <StatusBadge status={payout.status} />
                  </Td>
                  <Td numeric>
                    <Money value={payout.amount.toString()} />
                  </Td>
                  <Td numeric>
                    <Money value={payout.commission.toString()} tone="success" />
                  </Td>
                  <Td>
                    <DateTime value={payout.createdAt} />
                  </Td>
                </tr>
              ))}
            </Table>
          )}
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
          {deposits.length === 0 ? (
            <EmptyState>No deposits yet.</EmptyState>
          ) : (
            <Table head={["Reference", "Status", "Amount", "UTR", "When"]}>
              {deposits.map((deposit) => (
                <tr key={deposit.id}>
                  <Td>
                    <Reference>{deposit.reference}</Reference>
                  </Td>
                  <Td>
                    <StatusBadge status={deposit.status} />
                  </Td>
                  <Td numeric>
                    <Money value={deposit.amount.toString()} />
                  </Td>
                  <Td>
                    <span className="tabular text-xs text-muted">{deposit.utr}</span>
                  </Td>
                  <Td>
                    <DateTime value={deposit.createdAt} />
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}

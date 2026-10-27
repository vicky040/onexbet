import Link from "next/link";
import {
  approveDepositAction,
  failPayoutAction,
  rejectDepositAction,
  settlePayoutAction,
} from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/form";
import {
  AgentCell,
  Card,
  DateTime,
  EmptyState,
  Money,
  PageHeader,
  Reference,
  StatTile,
  Table,
  Td,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatInr, formatPercent } from "@/lib/money";
import { platformOverview } from "@/lib/stats";

export const metadata = { title: "Dashboard · 1XBET Agent Admin" };

const agentSelect = {
  select: { id: true, name: true, mobile: true, status: true },
} as const;

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

  return (
    <>
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
          {pendingDeposits.length === 0 ? (
            <EmptyState>Nothing to review. The queue is clear.</EmptyState>
          ) : (
            <Table
              head={["Reference", "Agent", "Amount", "UTR", "Submitted", ""]}
            >
              {pendingDeposits.map((deposit) => (
                <tr key={deposit.id}>
                  <Td>
                    <Reference>{deposit.reference}</Reference>
                  </Td>
                  <Td>
                    <AgentCell agent={deposit.agent} />
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
                  <Td>
                    <div className="flex justify-end gap-2">
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
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
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
          {reportedPayouts.length === 0 ? (
            <EmptyState>No payouts are waiting on a confirmation.</EmptyState>
          ) : (
            <Table head={["Reference", "Agent", "Amount", "Pay to", "Reported", ""]}>
              {reportedPayouts.map((payout) => (
                <tr key={payout.id}>
                  <Td>
                    <Reference>{payout.reference}</Reference>
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
                    <DateTime value={payout.paidAt} />
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-2">
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
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
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
          {recentPayins.length === 0 ? (
            <EmptyState>No payins recorded yet.</EmptyState>
          ) : (
            <Table head={["Reference", "Agent", "Amount", "Commission", "When"]}>
              {recentPayins.map((payin) => (
                <tr key={payin.id}>
                  <Td>
                    <Reference>{payin.reference}</Reference>
                  </Td>
                  <Td>
                    <AgentCell agent={payin.agent} />
                  </Td>
                  <Td numeric>
                    <Money value={payin.amount.toString()} />
                  </Td>
                  <Td numeric>
                    <Money value={payin.commission.toString()} tone="success" />
                  </Td>
                  <Td>
                    <DateTime value={payin.createdAt} />
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

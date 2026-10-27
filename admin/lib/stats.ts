import { prisma } from "./db";
import { D, toNumber, type Money } from "./money";
import type { Agent } from "./types";

/**
 * Aggregates behind the Flutter Home/Payin/History tabs and the admin
 * dashboard.
 */

// ---------------------------------------------------------------------------
// Agent dashboard summary (DashboardSummary in the Flutter app)
// ---------------------------------------------------------------------------

export async function agentSummary(agent: Agent) {
  const [payins, payoutCommission, payoutsCredited, deposits, payoutCounts] =
    await Promise.all([
      prisma.payin.aggregate({
        where: { agentId: agent.id, status: "COMPLETED" },
        _sum: { amount: true, commission: true },
      }),
      prisma.payout.aggregate({
        where: {
          agentId: agent.id,
          status: { in: ["PAYMENT_RECEIVED", "COMPLETED"] },
        },
        _sum: { commission: true },
      }),
      prisma.payout.aggregate({
        where: { agentId: agent.id, status: "COMPLETED" },
        _sum: { amount: true },
      }),
      prisma.deposit.aggregate({
        where: { agentId: agent.id, status: "COMPLETED" },
        _sum: { amount: true },
      }),
      prisma.payout.groupBy({
        by: ["status"],
        where: { agentId: agent.id, status: { not: "OPEN" } },
        _count: { _all: true },
      }),
    ]);

  const settled = payoutCounts.reduce((total, row) => total + row._count._all, 0);
  const successful = payoutCounts
    .filter((row) => row.status === "PAYMENT_RECEIVED" || row.status === "COMPLETED")
    .reduce((total, row) => total + row._count._all, 0);

  return {
    totalBalance: toNumber(agent.balance),
    successRate: settled === 0 ? 0 : Number(((successful / settled) * 100).toFixed(2)),
    securityDepositUsdt: toNumber(agent.securityDepositUsdt),
    payinCommission: toNumber(payins._sum.commission),
    payoutCommission: toNumber(payoutCommission._sum.commission),
    totalPayin: toNumber(payins._sum.amount),
    totalDeposit: toNumber(deposits._sum.amount),
    payoutsCredited: toNumber(payoutsCredited._sum.amount),
  };
}

// ---------------------------------------------------------------------------
// Weekly earnings (EarningWeek in the Flutter app)
// ---------------------------------------------------------------------------

/** Monday 00:00 of the week containing `date`, in UTC. */
function weekStart(date: Date): Date {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // getUTCDay(): 0 = Sunday, so Sunday belongs to the week that began 6 days ago.
  const shift = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - shift);
  return start;
}

/**
 * Masks a rupee volume the way the app's earnings table shows it:
 * 9812345623 -> "98******23".
 */
export function maskVolume(volume: number): string {
  const digits = Math.floor(Math.abs(volume)).toString();
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 2)}${"*".repeat(digits.length - 4)}${digits.slice(-2)}`;
}

export type EarningWeekRow = {
  week: number;
  weekStart: string;
  weekEnd: string;
  maskedTransactions: string;
  netEarnings: number;
  transactions: number;
  payinVolume: number;
  payinCommission: number;
  payoutCommission: number;
};

/**
 * The last `weeks` calendar weeks, newest first (week 1 = this week), which
 * is the order the Flutter earnings table renders.
 *
 * Rows are grouped in memory rather than with a date_trunc GROUP BY: the
 * window is bounded (8 weeks of one agent's records), and this keeps the
 * week boundaries identical to the ones used elsewhere in the app.
 */
export async function agentEarnings(
  agentId: string,
  weeks = 8,
): Promise<EarningWeekRow[]> {
  const thisWeek = weekStart(new Date());
  const from = new Date(thisWeek);
  from.setUTCDate(from.getUTCDate() - (weeks - 1) * 7);

  const [payins, payouts] = await Promise.all([
    prisma.payin.findMany({
      where: { agentId, status: "COMPLETED", createdAt: { gte: from } },
      select: { createdAt: true, amount: true, commission: true },
    }),
    prisma.payout.findMany({
      where: {
        agentId,
        status: { in: ["PAYMENT_RECEIVED", "COMPLETED"] },
        createdAt: { gte: from },
      },
      select: { createdAt: true, commission: true },
    }),
  ]);

  const buckets = new Map<
    number,
    {
      payinVolume: Money;
      payinCommission: Money;
      payoutCommission: Money;
      transactions: number;
    }
  >();

  for (let i = 0; i < weeks; i++) {
    const start = new Date(thisWeek);
    start.setUTCDate(start.getUTCDate() - i * 7);
    buckets.set(start.getTime(), {
      payinVolume: D(0),
      payinCommission: D(0),
      payoutCommission: D(0),
      transactions: 0,
    });
  }

  for (const payin of payins) {
    const bucket = buckets.get(weekStart(payin.createdAt).getTime());
    if (!bucket) continue;
    bucket.payinVolume = bucket.payinVolume.add(payin.amount);
    bucket.payinCommission = bucket.payinCommission.add(payin.commission);
    bucket.transactions += 1;
  }

  for (const payout of payouts) {
    const bucket = buckets.get(weekStart(payout.createdAt).getTime());
    if (!bucket) continue;
    bucket.payoutCommission = bucket.payoutCommission.add(payout.commission);
    bucket.transactions += 1;
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => b - a)
    .map(([startMs, bucket], index) => {
      const start = new Date(startMs);
      const end = new Date(startMs);
      end.setUTCDate(end.getUTCDate() + 6);
      const payinVolume = toNumber(bucket.payinVolume);
      return {
        week: index + 1,
        weekStart: start.toISOString(),
        weekEnd: end.toISOString(),
        maskedTransactions: maskVolume(payinVolume),
        netEarnings: toNumber(
          bucket.payinCommission.add(bucket.payoutCommission),
        ),
        transactions: bucket.transactions,
        payinVolume,
        payinCommission: toNumber(bucket.payinCommission),
        payoutCommission: toNumber(bucket.payoutCommission),
      };
    });
}

// ---------------------------------------------------------------------------
// Admin dashboard
// ---------------------------------------------------------------------------

export async function platformOverview() {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  const [
    agentCounts,
    balances,
    pendingDeposits,
    openPayouts,
    todayPayins,
    allTimePayins,
    unreadSupport,
    settledPayouts,
  ] = await Promise.all([
    prisma.agent.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.agent.aggregate({ _sum: { balance: true } }),
    prisma.deposit.aggregate({
      where: { status: "PENDING" },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.payout.aggregate({
      where: { status: "OPEN" },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.payin.aggregate({
      where: { status: "COMPLETED", createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { amount: true, commission: true },
    }),
    prisma.payin.aggregate({
      where: { status: "COMPLETED" },
      _sum: { amount: true, commission: true },
    }),
    prisma.supportMessage.count({ where: { fromAgent: true, readByAdmin: false } }),
    prisma.payout.groupBy({
      by: ["status"],
      where: { status: { not: "OPEN" } },
      _count: { _all: true },
      _sum: { amount: true, commission: true },
    }),
  ]);

  const byStatus = (status: string) =>
    agentCounts.find((row) => row.status === status)?._count._all ?? 0;

  const settledCount = settledPayouts.reduce((t, r) => t + r._count._all, 0);
  const successfulCount = settledPayouts
    .filter((r) => r.status === "PAYMENT_RECEIVED" || r.status === "COMPLETED")
    .reduce((t, r) => t + r._count._all, 0);
  const payoutVolume = settledPayouts.reduce(
    (total, row) => total.add(D(row._sum.amount ?? 0)),
    D(0),
  );
  const payoutCommission = settledPayouts.reduce(
    (total, row) => total.add(D(row._sum.commission ?? 0)),
    D(0),
  );

  return {
    agents: {
      total: agentCounts.reduce((t, r) => t + r._count._all, 0),
      active: byStatus("ACTIVE"),
      pending: byStatus("PENDING"),
      blocked: byStatus("BLOCKED"),
    },
    balanceHeld: toNumber(balances._sum.balance),
    deposits: {
      pendingCount: pendingDeposits._count._all,
      pendingAmount: toNumber(pendingDeposits._sum.amount),
    },
    payouts: {
      openCount: openPayouts._count._all,
      openAmount: toNumber(openPayouts._sum.amount),
      settledCount,
      volume: toNumber(payoutVolume),
      commission: toNumber(payoutCommission),
      successRate:
        settledCount === 0
          ? 0
          : Number(((successfulCount / settledCount) * 100).toFixed(2)),
    },
    payins: {
      todayCount: todayPayins._count._all,
      todayVolume: toNumber(todayPayins._sum.amount),
      todayCommission: toNumber(todayPayins._sum.commission),
      totalVolume: toNumber(allTimePayins._sum.amount),
      totalCommission: toNumber(allTimePayins._sum.commission),
    },
    support: { unread: unreadSupport },
  };
}

export type PlatformOverview = Awaited<ReturnType<typeof platformOverview>>;

import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { ApiError } from "./errors";
import {
  depositReference,
  payinReference,
  payoutReference,
  withUniqueReference,
} from "./ids";
import { commissionOf, D, money, toNumber, type Numeric } from "./money";
import type { Deposit, Payin, Payout } from "./types";
import { writeAudit } from "./audit";

/**
 * Every balance change in the system goes through this module.
 *
 * The ledger model, taken from how the Flutter app presents each record:
 *
 *   deposit  — the agent funds their platform balance:
 *              balance += amount            (on approval)
 *   payin    — a player paid money into the agent's bank, and the platform
 *              credited that player, so the agent's float is spent:
 *              balance += commission - amount
 *   payout   — the agent paid a player out of their own bank, so the
 *              platform owes them the money back plus commission:
 *              balance += amount + commission   (on settlement)
 *
 * Balances are therefore never allowed below zero, and every change is
 * applied with a single atomic UPDATE ... RETURNING rather than a
 * read-modify-write, so two concurrent operations can never lose one
 * another's update.
 */

type Tx = Prisma.TransactionClient;

type BalanceChange = { previousBalance: Prisma.Decimal; newBalance: Prisma.Decimal };

/**
 * Adds `delta` (which may be negative) to the agent's balance atomically and
 * reports the balance either side of the change.
 */
async function applyBalanceDelta(
  tx: Tx,
  agentId: string,
  delta: Numeric,
): Promise<BalanceChange> {
  const amount = money(delta);
  const rows = await tx.$queryRaw<{ balance: string | number }[]>`
    UPDATE "Agent"
       SET balance = balance + ${amount.toFixed(2)}::numeric,
           "updatedAt" = now()
     WHERE id = ${agentId}
    RETURNING balance
  `;

  if (rows.length === 0) throw ApiError.notFound("Agent");

  const newBalance = money(rows[0].balance);
  if (newBalance.isNegative()) {
    throw new ApiError(
      "insufficient_balance",
      "This would take the agent's balance below zero",
      { shortfall: toNumber(newBalance.abs()) },
    );
  }

  return { previousBalance: money(newBalance.sub(amount)), newBalance };
}

/** Queues an in-app notification; used by the operations below. */
async function notifyAgent(
  tx: Tx,
  input: {
    agentId: string;
    title: string;
    body: string;
    createdById?: string | null;
    broadcastId?: string | null;
  },
) {
  return tx.notification.create({
    data: {
      agentId: input.agentId,
      title: input.title,
      body: input.body,
      createdById: input.createdById ?? null,
      broadcastId: input.broadcastId ?? null,
    },
  });
}

const inr = (value: Numeric) =>
  `₹${toNumber(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// ---------------------------------------------------------------------------
// Deposits
// ---------------------------------------------------------------------------

/** An agent submits a deposit request. Nothing is credited until approved. */
export async function createDeposit(input: {
  agentId: string;
  amount: Numeric;
  utr: string;
  proofUrl?: string | null;
  autoApprove?: boolean;
}): Promise<Deposit> {
  const amount = money(input.amount);

  return prisma.$transaction(async (tx) => {
    const agent = await tx.agent.findUnique({
      where: { id: input.agentId },
      select: { balance: true },
    });
    if (!agent) throw ApiError.notFound("Agent");

    const deposit = await withUniqueReference(
      (reference) =>
        tx.deposit.create({
          data: {
            reference,
            agentId: input.agentId,
            amount,
            previousBalance: agent.balance,
            utr: input.utr,
            proofUrl: input.proofUrl ?? null,
            status: "PENDING",
          },
        }),
      depositReference,
    );

    if (!input.autoApprove) return deposit;

    const change = await applyBalanceDelta(tx, input.agentId, amount);
    return tx.deposit.update({
      where: { id: deposit.id },
      data: {
        status: "COMPLETED",
        previousBalance: change.previousBalance,
        afterBalance: change.newBalance,
        reviewedAt: new Date(),
        reviewNote: "Auto-approved",
      },
    });
  });
}

/** Admin approves a pending deposit, crediting the agent's balance. */
export async function approveDeposit(input: {
  depositId: string;
  adminId: string;
  note?: string;
}): Promise<Deposit> {
  const deposit = await prisma.$transaction(async (tx) => {
    const existing = await tx.deposit.findUnique({
      where: { id: input.depositId },
    });
    if (!existing) throw ApiError.notFound("Deposit");
    if (existing.status !== "PENDING") {
      throw ApiError.conflict(
        `This deposit has already been ${existing.status === "COMPLETED" ? "approved" : "rejected"}`,
      );
    }

    const change = await applyBalanceDelta(tx, existing.agentId, existing.amount);

    const updated = await tx.deposit.update({
      where: { id: existing.id },
      data: {
        status: "COMPLETED",
        previousBalance: change.previousBalance,
        afterBalance: change.newBalance,
        reviewedById: input.adminId,
        reviewedAt: new Date(),
        reviewNote: input.note ?? null,
      },
    });

    await notifyAgent(tx, {
      agentId: existing.agentId,
      title: "Deposit approved",
      body: `Your deposit ${existing.reference} of ${inr(existing.amount)} has been completed.`,
      createdById: input.adminId,
    });

    return updated;
  });

  await writeAudit({
    adminId: input.adminId,
    action: "deposit.approve",
    entity: "Deposit",
    entityId: deposit.id,
    summary: `Approved deposit ${deposit.reference} of ${inr(deposit.amount)}`,
    meta: { amount: toNumber(deposit.amount), agentId: deposit.agentId },
  });

  return deposit;
}

/** Admin rejects a pending deposit. No balance change. */
export async function rejectDeposit(input: {
  depositId: string;
  adminId: string;
  note?: string;
}): Promise<Deposit> {
  const deposit = await prisma.$transaction(async (tx) => {
    const existing = await tx.deposit.findUnique({
      where: { id: input.depositId },
    });
    if (!existing) throw ApiError.notFound("Deposit");
    if (existing.status !== "PENDING") {
      throw ApiError.conflict("Only a pending deposit can be rejected");
    }

    const updated = await tx.deposit.update({
      where: { id: existing.id },
      data: {
        status: "FAILED",
        reviewedById: input.adminId,
        reviewedAt: new Date(),
        reviewNote: input.note ?? null,
      },
    });

    await notifyAgent(tx, {
      agentId: existing.agentId,
      title: "Deposit rejected",
      body: input.note
        ? `Deposit ${existing.reference} of ${inr(existing.amount)} was rejected: ${input.note}`
        : `Deposit ${existing.reference} of ${inr(existing.amount)} was rejected. Please check the UTR and try again.`,
      createdById: input.adminId,
    });

    return updated;
  });

  await writeAudit({
    adminId: input.adminId,
    action: "deposit.reject",
    entity: "Deposit",
    entityId: deposit.id,
    summary: `Rejected deposit ${deposit.reference} of ${inr(deposit.amount)}`,
    meta: { reason: input.note ?? null, agentId: deposit.agentId },
  });

  return deposit;
}

// ---------------------------------------------------------------------------
// Payins
// ---------------------------------------------------------------------------

/**
 * Records a payin against an agent: their float drops by the amount and
 * their commission is credited.
 */
export async function recordPayin(input: {
  agentId: string;
  amount: Numeric;
  txnRef: string;
  bankAccountId?: string | null;
  commissionRate?: Numeric;
  adminId?: string | null;
}): Promise<Payin> {
  const amount = money(input.amount);

  const payin = await prisma.$transaction(async (tx) => {
    const agent = await tx.agent.findUnique({
      where: { id: input.agentId },
      select: { id: true, payinCommissionRate: true },
    });
    if (!agent) throw ApiError.notFound("Agent");

    if (input.bankAccountId) {
      const bank = await tx.bankAccount.findFirst({
        where: { id: input.bankAccountId, agentId: input.agentId },
        select: { id: true },
      });
      if (!bank) throw ApiError.notFound("Bank account");
    }

    const rate = D(input.commissionRate ?? agent.payinCommissionRate);
    const commission = commissionOf(amount, rate);

    // Net effect on the float: commission earned, amount spent.
    const change = await applyBalanceDelta(tx, input.agentId, commission.sub(amount));

    const created = await withUniqueReference(
      (reference) =>
        tx.payin.create({
          data: {
            reference,
            agentId: input.agentId,
            bankAccountId: input.bankAccountId ?? null,
            amount,
            commissionRate: rate,
            commission,
            previousBalance: change.previousBalance,
            afterBalance: change.newBalance,
            txnRef: input.txnRef,
            status: "COMPLETED",
            createdById: input.adminId ?? null,
          },
        }),
      payinReference,
    );

    await notifyAgent(tx, {
      agentId: input.agentId,
      title: "Payin received",
      body: `${inr(amount)} processed from your wallet. Commission ${inr(commission)} earned.`,
      createdById: input.adminId ?? null,
    });

    return created;
  });

  if (input.adminId) {
    await writeAudit({
      adminId: input.adminId,
      action: "payin.create",
      entity: "Payin",
      entityId: payin.id,
      summary: `Recorded payin ${payin.reference} of ${inr(payin.amount)}`,
      meta: {
        agentId: payin.agentId,
        amount: toNumber(payin.amount),
        commission: toNumber(payin.commission),
      },
    });
  }

  return payin;
}

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

/** Admin creates a payout, either open to all agents or assigned to one. */
export async function createPayout(input: {
  amount: Numeric;
  upiId: string;
  agentId?: string | null;
  commissionRate?: Numeric;
  note?: string | null;
  adminId: string;
}): Promise<Payout> {
  const amount = money(input.amount);

  const payout = await prisma.$transaction(async (tx) => {
    let rate = D(input.commissionRate ?? 0);

    if (input.agentId) {
      const agent = await tx.agent.findUnique({
        where: { id: input.agentId },
        select: { payoutCommissionRate: true },
      });
      if (!agent) throw ApiError.notFound("Agent");
      if (input.commissionRate === undefined) rate = D(agent.payoutCommissionRate);
    } else if (input.commissionRate === undefined) {
      const settings = await tx.settings.findUnique({ where: { id: "default" } });
      rate = D(settings?.defaultPayoutCommissionRate ?? 2);
    }

    return withUniqueReference(
      (reference) =>
        tx.payout.create({
          data: {
            reference,
            agentId: input.agentId ?? null,
            amount,
            commissionRate: rate,
            commission: commissionOf(amount, rate),
            upiId: input.upiId,
            note: input.note ?? null,
            status: "OPEN",
            createdById: input.adminId,
          },
        }),
      payoutReference,
    );
  });

  await writeAudit({
    adminId: input.adminId,
    action: "payout.create",
    entity: "Payout",
    entityId: payout.id,
    summary: `Created payout ${payout.reference} of ${inr(payout.amount)}`,
    meta: {
      agentId: payout.agentId,
      amount: toNumber(payout.amount),
      upiId: payout.upiId,
    },
  });

  return payout;
}

/**
 * An agent claims an open payout. The status filter in the UPDATE makes this
 * safe when two agents tap at the same moment — exactly one wins.
 */
export async function acceptPayout(input: {
  reference: string;
  agentId: string;
}): Promise<Payout> {
  const payout = await prisma.payout.findUnique({
    where: { reference: input.reference },
  });
  if (!payout) throw ApiError.notFound("Payout");
  if (payout.agentId && payout.agentId !== input.agentId) {
    throw ApiError.conflict("This payout has already been taken");
  }
  if (payout.status !== "OPEN") {
    throw ApiError.conflict("This payout is no longer open");
  }

  const claimed = await prisma.payout.updateMany({
    where: { id: payout.id, status: "OPEN" },
    data: {
      agentId: input.agentId,
      status: "ACCEPTED",
      acceptedAt: new Date(),
    },
  });

  if (claimed.count === 0) {
    throw ApiError.conflict("This payout has already been taken");
  }

  return prisma.payout.findUniqueOrThrow({ where: { id: payout.id } });
}

/** The agent reports that they have paid the player. Awaits admin checking. */
export async function markPayoutPaid(input: {
  reference: string;
  agentId: string;
  note?: string;
}): Promise<Payout> {
  const payout = await prisma.payout.findUnique({
    where: { reference: input.reference },
  });
  if (!payout) throw ApiError.notFound("Payout");
  if (payout.agentId !== input.agentId) {
    throw ApiError.forbidden("This payout belongs to another agent");
  }
  if (payout.status !== "ACCEPTED") {
    throw ApiError.conflict(
      payout.status === "OPEN"
        ? "Accept the payout before marking it paid"
        : "This payout has already been reported",
    );
  }

  return prisma.payout.update({
    where: { id: payout.id },
    data: {
      status: "PAYMENT_RECEIVED",
      paidAt: new Date(),
      note: input.note ?? payout.note,
    },
  });
}

/** Admin confirms the player was paid and credits the agent. */
export async function settlePayout(input: {
  payoutId: string;
  adminId: string;
}): Promise<Payout> {
  const payout = await prisma.$transaction(async (tx) => {
    const existing = await tx.payout.findUnique({ where: { id: input.payoutId } });
    if (!existing) throw ApiError.notFound("Payout");
    if (!existing.agentId) {
      throw ApiError.conflict("Assign the payout to an agent before settling it");
    }
    if (existing.status === "COMPLETED") {
      throw ApiError.conflict("This payout has already been settled");
    }
    if (existing.status !== "PAYMENT_RECEIVED" && existing.status !== "ACCEPTED") {
      throw ApiError.conflict("Only an accepted or paid payout can be settled");
    }

    await applyBalanceDelta(
      tx,
      existing.agentId,
      D(existing.amount).add(existing.commission),
    );

    const updated = await tx.payout.update({
      where: { id: existing.id },
      data: {
        status: "COMPLETED",
        settledAt: new Date(),
        paidAt: existing.paidAt ?? new Date(),
      },
    });

    await notifyAgent(tx, {
      agentId: existing.agentId,
      title: "Payout completed",
      body: `Payout ${existing.reference} of ${inr(existing.amount)} was received successfully. Commission ${inr(existing.commission)} credited.`,
      createdById: input.adminId,
    });

    return updated;
  });

  await writeAudit({
    adminId: input.adminId,
    action: "payout.settle",
    entity: "Payout",
    entityId: payout.id,
    summary: `Settled payout ${payout.reference} of ${inr(payout.amount)}`,
    meta: {
      agentId: payout.agentId,
      credited: toNumber(D(payout.amount).add(payout.commission)),
    },
  });

  return payout;
}

/** Admin marks a payout failed. An open payout is released back to the pool. */
export async function failPayout(input: {
  payoutId: string;
  adminId: string;
  note?: string;
}): Promise<Payout> {
  const payout = await prisma.$transaction(async (tx) => {
    const existing = await tx.payout.findUnique({ where: { id: input.payoutId } });
    if (!existing) throw ApiError.notFound("Payout");
    if (existing.status === "COMPLETED") {
      throw ApiError.conflict(
        "This payout is already settled; adjust the balance instead",
      );
    }

    const updated = await tx.payout.update({
      where: { id: existing.id },
      data: { status: "FAILED", note: input.note ?? existing.note },
    });

    if (existing.agentId) {
      await notifyAgent(tx, {
        agentId: existing.agentId,
        title: "Payout failed",
        body: input.note
          ? `Payout ${existing.reference} was marked failed: ${input.note}`
          : `Payout ${existing.reference} of ${inr(existing.amount)} was marked failed.`,
        createdById: input.adminId,
      });
    }

    return updated;
  });

  await writeAudit({
    adminId: input.adminId,
    action: "payout.fail",
    entity: "Payout",
    entityId: payout.id,
    summary: `Marked payout ${payout.reference} failed`,
    meta: { reason: input.note ?? null },
  });

  return payout;
}

// ---------------------------------------------------------------------------
// Manual balance adjustment
// ---------------------------------------------------------------------------

export async function adjustBalance(input: {
  agentId: string;
  amount: Numeric;
  reason: string;
  adminId: string;
}) {
  const delta = money(input.amount);

  const result = await prisma.$transaction(async (tx) => {
    const change = await applyBalanceDelta(tx, input.agentId, delta);

    await notifyAgent(tx, {
      agentId: input.agentId,
      title: delta.isPositive() ? "Balance credited" : "Balance debited",
      body: `${inr(delta.abs())} was ${delta.isPositive() ? "added to" : "deducted from"} your balance. ${input.reason}`,
      createdById: input.adminId,
    });

    return change;
  });

  await writeAudit({
    adminId: input.adminId,
    action: "agent.adjustBalance",
    entity: "Agent",
    entityId: input.agentId,
    summary: `${delta.isPositive() ? "Credited" : "Debited"} ${inr(delta.abs())} — ${input.reason}`,
    meta: {
      delta: toNumber(delta),
      previousBalance: toNumber(result.previousBalance),
      newBalance: toNumber(result.newBalance),
      reason: input.reason,
    },
  });

  return {
    previousBalance: toNumber(result.previousBalance),
    newBalance: toNumber(result.newBalance),
  };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function sendNotification(input: {
  title: string;
  body: string;
  agentId?: string;
  broadcast?: boolean;
  adminId: string;
}) {
  if (input.agentId) {
    const agent = await prisma.agent.findUnique({
      where: { id: input.agentId },
      select: { id: true },
    });
    if (!agent) throw ApiError.notFound("Agent");

    const notification = await prisma.notification.create({
      data: {
        agentId: input.agentId,
        title: input.title,
        body: input.body,
        createdById: input.adminId,
      },
    });

    await writeAudit({
      adminId: input.adminId,
      action: "notification.send",
      entity: "Notification",
      entityId: notification.id,
      summary: `Notified one agent: ${input.title}`,
      meta: { agentId: input.agentId },
    });

    return { recipients: 1 };
  }

  const recipients = await prisma.agent.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  if (recipients.length === 0) {
    throw ApiError.conflict("There are no active agents to notify");
  }

  const broadcastId = crypto.randomUUID();
  await prisma.notification.createMany({
    data: recipients.map((agent) => ({
      agentId: agent.id,
      title: input.title,
      body: input.body,
      broadcastId,
      createdById: input.adminId,
    })),
  });

  await writeAudit({
    adminId: input.adminId,
    action: "notification.broadcast",
    entity: "Notification",
    entityId: broadcastId,
    summary: `Broadcast to ${recipients.length} agents: ${input.title}`,
    meta: { recipients: recipients.length },
  });

  return { recipients: recipients.length, broadcastId };
}

// ---------------------------------------------------------------------------
// Corrections (super admin)
// ---------------------------------------------------------------------------

/**
 * Corrects a payin's figures and moves the agent's balance by the
 * difference.
 *
 * A payin's effect on the float is `commission - amount`. Re-computing that
 * and applying only the delta means the balance ends up where it would have
 * been had the record been right the first time, without unwinding
 * everything that happened since.
 *
 * `previousBalance` and `afterBalance` on *this* record are rewritten to
 * match; the snapshots on later records are left alone, because they are a
 * record of what the balance actually was at the time.
 */
export async function updatePayin(input: {
  payinId: string;
  amount?: Numeric;
  commissionRate?: Numeric;
  txnRef?: string;
  reason: string;
  adminId: string;
}): Promise<Payin> {
  const payin = await prisma.$transaction(async (tx) => {
    const existing = await tx.payin.findUnique({ where: { id: input.payinId } });
    if (!existing) throw ApiError.notFound("Payin");

    const amount = money(input.amount ?? existing.amount);
    const rate = D(input.commissionRate ?? existing.commissionRate);
    const commission = commissionOf(amount, rate);

    const oldEffect = D(existing.commission).sub(existing.amount);
    const newEffect = commission.sub(amount);
    const difference = newEffect.sub(oldEffect);

    let previousBalance = existing.previousBalance;
    let afterBalance = existing.afterBalance;

    if (!difference.isZero()) {
      const change = await applyBalanceDelta(tx, existing.agentId, difference);
      // This record now describes the balance it leaves behind.
      previousBalance = money(D(change.newBalance).sub(newEffect));
      afterBalance = change.newBalance;
    }

    const updated = await tx.payin.update({
      where: { id: existing.id },
      data: {
        amount,
        commissionRate: rate,
        commission,
        previousBalance,
        afterBalance,
        txnRef: input.txnRef ?? existing.txnRef,
      },
    });

    if (!difference.isZero()) {
      await notifyAgent(tx, {
        agentId: existing.agentId,
        title: "Payin corrected",
        body: `Payin ${existing.reference} was corrected to ${inr(amount)} (commission ${inr(commission)}). ${input.reason}`,
        createdById: input.adminId,
      });
    }

    return updated;
  });

  await writeAudit({
    adminId: input.adminId,
    action: "payin.update",
    entity: "Payin",
    entityId: payin.id,
    summary: `Corrected payin ${payin.reference} to ${inr(payin.amount)}`,
    meta: {
      agentId: payin.agentId,
      amount: toNumber(payin.amount),
      commission: toNumber(payin.commission),
      commissionRate: toNumber(payin.commissionRate),
      reason: input.reason,
    },
  });

  return payin;
}

/**
 * Corrects a payout's figures.
 *
 * A settled payout has already credited `amount + commission`, so the
 * difference is applied to the balance. One that is still open, accepted or
 * failed has moved no money, so only the record changes.
 */
export async function updatePayoutAmounts(input: {
  payoutId: string;
  amount?: Numeric;
  commissionRate?: Numeric;
  upiId?: string;
  reason: string;
  adminId: string;
}): Promise<Payout> {
  const payout = await prisma.$transaction(async (tx) => {
    const existing = await tx.payout.findUnique({ where: { id: input.payoutId } });
    if (!existing) throw ApiError.notFound("Payout");

    const amount = money(input.amount ?? existing.amount);
    const rate = D(input.commissionRate ?? existing.commissionRate);
    const commission = commissionOf(amount, rate);

    const wasCredited = existing.status === "COMPLETED";
    if (wasCredited && existing.agentId) {
      const oldCredit = D(existing.amount).add(existing.commission);
      const newCredit = amount.add(commission);
      const difference = newCredit.sub(oldCredit);
      if (!difference.isZero()) {
        await applyBalanceDelta(tx, existing.agentId, difference);
      }
    }

    const updated = await tx.payout.update({
      where: { id: existing.id },
      data: {
        amount,
        commissionRate: rate,
        commission,
        upiId: input.upiId ?? existing.upiId,
      },
    });

    if (existing.agentId) {
      await notifyAgent(tx, {
        agentId: existing.agentId,
        title: "Payout corrected",
        body: `Payout ${existing.reference} was corrected to ${inr(amount)} (commission ${inr(commission)}). ${input.reason}`,
        createdById: input.adminId,
      });
    }

    return updated;
  });

  await writeAudit({
    adminId: input.adminId,
    action: "payout.updateAmounts",
    entity: "Payout",
    entityId: payout.id,
    summary: `Corrected payout ${payout.reference} to ${inr(payout.amount)}`,
    meta: {
      agentId: payout.agentId,
      amount: toNumber(payout.amount),
      commission: toNumber(payout.commission),
      status: payout.status,
      reason: input.reason,
    },
  });

  return payout;
}

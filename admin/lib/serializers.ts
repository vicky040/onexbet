import type {
  Agent,
  AppNotification,
  BankAccount,
  Deposit,
  Payin,
  Payout,
  PayoutStatus,
  SupportMessage,
  TxnStatus,
} from "./types";
import { toNumber } from "./money";

/**
 * The wire format. These shapes are what the Flutter app parses, so the keys
 * match its models in lib/data/models/ exactly — `limit` for a bank's daily
 * limit, `fromUser` for a chat message, `maskedTransactions` for an earnings
 * row. Extra keys are additive and safely ignored by the Dart parsers.
 *
 * Dates go out as ISO-8601 UTC strings (DateTime.parse handles them), money
 * as JSON numbers, and statuses as the stable upper-snake codes below plus a
 * human `statusLabel`.
 */

export const STATUS_LABELS: Record<TxnStatus, string> = {
  COMPLETED: "Completed",
  PAYMENT_RECEIVED: "Payment Received",
  PENDING: "Pending",
  FAILED: "Failed",
};

/** Collapses the richer payout lifecycle onto the app's four-state TxnStatus. */
export function payoutTxnStatus(status: PayoutStatus): TxnStatus {
  switch (status) {
    case "PAYMENT_RECEIVED":
      return "PAYMENT_RECEIVED";
    case "COMPLETED":
      return "COMPLETED";
    case "FAILED":
    case "CANCELLED":
      return "FAILED";
    case "OPEN":
    case "ACCEPTED":
    default:
      return "PENDING";
  }
}

function iso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

function status(value: TxnStatus) {
  return { status: value, statusLabel: STATUS_LABELS[value] };
}

// ---------------------------------------------------------------------------
// Agent-facing (v1)
// ---------------------------------------------------------------------------

/** Matches User.fromJson in lib/data/models/user.dart. */
export function serializeAgent(agent: Agent) {
  return {
    id: agent.id,
    name: agent.name,
    mobile: agent.mobile,
    email: agent.email,
    status: agent.status,
    plan: agent.plan,
    referralCode: agent.referralCode,
    payinCommissionRate: toNumber(agent.payinCommissionRate),
    payoutCommissionRate: toNumber(agent.payoutCommissionRate),
    createdAt: iso(agent.createdAt),
  };
}

/** Matches BankAccount in lib/data/models/bank_account.dart. */
export function serializeBankAccount(bank: BankAccount) {
  return {
    id: bank.id,
    bankName: bank.bankName,
    accountHolder: bank.accountHolder,
    accountNumber: bank.accountNumber,
    ifsc: bank.ifsc,
    upiId: bank.upiId,
    // `limit` is the key the Dart model reads; `dailyLimit` is its real name.
    limit: bank.dailyLimit,
    dailyLimit: bank.dailyLimit,
    amountLimit: toNumber(bank.amountLimit),
    txnLimit: bank.txnLimit,
    isActive: bank.isActive,
    createdAt: iso(bank.createdAt),
  };
}

/** Matches PayinRecord in lib/data/models/transactions.dart. */
export function serializePayin(payin: Payin) {
  return {
    id: payin.reference,
    reference: payin.reference,
    createdAt: iso(payin.createdAt),
    previousBalance: toNumber(payin.previousBalance),
    amount: toNumber(payin.amount),
    commissionRate: toNumber(payin.commissionRate),
    commission: toNumber(payin.commission),
    afterBalance: toNumber(payin.afterBalance),
    txnRef: payin.txnRef,
    ...status(payin.status),
  };
}

/** Matches OpenPayout — the payouts offered on the Payout tab. */
export function serializeOpenPayout(payout: Payout) {
  return {
    id: payout.reference,
    reference: payout.reference,
    amount: toNumber(payout.amount),
    commission: toNumber(payout.commission),
    commissionRate: toNumber(payout.commissionRate),
    upiId: payout.upiId,
    note: payout.note,
    createdAt: iso(payout.createdAt),
  };
}

/** Matches PayoutPayment — the rows under "My Payments". */
export function serializePayoutPayment(payout: Payout) {
  return {
    id: payout.reference,
    reference: payout.reference,
    createdAt: iso(payout.createdAt),
    amount: toNumber(payout.amount),
    commission: toNumber(payout.commission),
    upiId: payout.upiId,
    /// What it was for, when it was not an ordinary player payout.
    note: payout.note,
    acceptedAt: iso(payout.acceptedAt),
    paidAt: iso(payout.paidAt),
    payoutStatus: payout.status,
    ...status(payoutTxnStatus(payout.status)),
  };
}

/** Matches DepositRecord in lib/data/models/transactions.dart. */
export function serializeDeposit(deposit: Deposit) {
  return {
    id: deposit.reference,
    reference: deposit.reference,
    createdAt: iso(deposit.createdAt),
    previousBalance: toNumber(deposit.previousBalance),
    amount: toNumber(deposit.amount),
    currency: deposit.currency,
    plan: deposit.plan,
    amountUsdt:
      deposit.amountUsdt === null ? null : toNumber(deposit.amountUsdt),
    usdtRate: deposit.usdtRate === null ? null : toNumber(deposit.usdtRate),
    afterBalance:
      deposit.afterBalance === null
        ? toNumber(deposit.previousBalance) + toNumber(deposit.amount)
        : toNumber(deposit.afterBalance),
    utr: deposit.utr,
    proofUrl: deposit.proofUrl,
    reviewNote: deposit.reviewNote,
    reviewedAt: iso(deposit.reviewedAt),
    ...status(deposit.status),
  };
}

/** Matches AppNotification in lib/data/models/messages.dart. */
export function serializeNotification(notification: AppNotification) {
  return {
    id: notification.id,
    title: notification.title,
    body: notification.body,
    read: notification.read,
    createdAt: iso(notification.createdAt),
  };
}

/** Matches ChatMessage in lib/data/models/messages.dart. */
export function serializeChatMessage(message: SupportMessage) {
  return {
    id: message.id,
    text: message.text,
    // The Dart model's key is `fromUser`.
    fromUser: message.fromAgent,
    fromAgent: message.fromAgent,
    createdAt: iso(message.createdAt),
  };
}

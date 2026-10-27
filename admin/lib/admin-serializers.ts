import { toNumber } from "./money";
import { STATUS_LABELS, payoutTxnStatus } from "./serializers";
import type {
  Admin,
  Agent,
  AuditLog,
  BankAccount,
  Deposit,
  Payin,
  Payout,
  Settings,
  SupportMessage,
} from "./types";

/**
 * Admin-facing shapes. Unlike the v1 API these expose the database id (the
 * admin endpoints act on it) alongside the human reference code, and they
 * embed a short agent summary so list screens need no second request.
 */

type WithAgent<T> = T & {
  agent?: Pick<Agent, "id" | "name" | "mobile" | "status"> | null;
};

const iso = (date: Date | null | undefined) => (date ? date.toISOString() : null);

export function agentRef(
  agent: Pick<Agent, "id" | "name" | "mobile" | "status"> | null | undefined,
) {
  return agent
    ? {
        id: agent.id,
        name: agent.name,
        mobile: agent.mobile,
        status: agent.status,
      }
    : null;
}

export function adminAgent(agent: Agent & { _count?: Record<string, number> }) {
  return {
    id: agent.id,
    name: agent.name,
    mobile: agent.mobile,
    email: agent.email,
    status: agent.status,
    balance: toNumber(agent.balance),
    securityDepositUsdt: toNumber(agent.securityDepositUsdt),
    payinCommissionRate: toNumber(agent.payinCommissionRate),
    payoutCommissionRate: toNumber(agent.payoutCommissionRate),
    notes: agent.notes,
    lastLoginAt: iso(agent.lastLoginAt),
    createdAt: iso(agent.createdAt),
    counts: agent._count ?? undefined,
  };
}

export function adminDeposit(deposit: WithAgent<Deposit>) {
  return {
    id: deposit.id,
    reference: deposit.reference,
    agent: agentRef(deposit.agent),
    agentId: deposit.agentId,
    amount: toNumber(deposit.amount),
    previousBalance: toNumber(deposit.previousBalance),
    afterBalance: deposit.afterBalance === null ? null : toNumber(deposit.afterBalance),
    status: deposit.status,
    statusLabel: STATUS_LABELS[deposit.status],
    utr: deposit.utr,
    proofUrl: deposit.proofUrl,
    reviewNote: deposit.reviewNote,
    reviewedById: deposit.reviewedById,
    reviewedAt: iso(deposit.reviewedAt),
    createdAt: iso(deposit.createdAt),
  };
}

export function adminPayin(payin: WithAgent<Payin>) {
  return {
    id: payin.id,
    reference: payin.reference,
    agent: agentRef(payin.agent),
    agentId: payin.agentId,
    amount: toNumber(payin.amount),
    commission: toNumber(payin.commission),
    commissionRate: toNumber(payin.commissionRate),
    previousBalance: toNumber(payin.previousBalance),
    afterBalance: toNumber(payin.afterBalance),
    txnRef: payin.txnRef,
    bankAccountId: payin.bankAccountId,
    status: payin.status,
    statusLabel: STATUS_LABELS[payin.status],
    createdAt: iso(payin.createdAt),
  };
}

export function adminPayout(payout: WithAgent<Payout>) {
  return {
    id: payout.id,
    reference: payout.reference,
    agent: agentRef(payout.agent),
    agentId: payout.agentId,
    amount: toNumber(payout.amount),
    commission: toNumber(payout.commission),
    commissionRate: toNumber(payout.commissionRate),
    upiId: payout.upiId,
    status: payout.status,
    /** How the Flutter app will show it, for cross-checking. */
    appStatus: payoutTxnStatus(payout.status),
    note: payout.note,
    acceptedAt: iso(payout.acceptedAt),
    paidAt: iso(payout.paidAt),
    settledAt: iso(payout.settledAt),
    createdAt: iso(payout.createdAt),
  };
}

export function adminBankAccount(bank: WithAgent<BankAccount>) {
  return {
    id: bank.id,
    agent: agentRef(bank.agent),
    agentId: bank.agentId,
    bankName: bank.bankName,
    accountHolder: bank.accountHolder,
    accountNumber: bank.accountNumber,
    ifsc: bank.ifsc,
    upiId: bank.upiId,
    dailyLimit: bank.dailyLimit,
    amountLimit: toNumber(bank.amountLimit),
    txnLimit: bank.txnLimit,
    isActive: bank.isActive,
    createdAt: iso(bank.createdAt),
  };
}

export function adminSupportMessage(message: SupportMessage) {
  return {
    id: message.id,
    agentId: message.agentId,
    text: message.text,
    fromAgent: message.fromAgent,
    adminId: message.adminId,
    readByAdmin: message.readByAdmin,
    createdAt: iso(message.createdAt),
  };
}

export function adminProfile(admin: Admin) {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    lastLoginAt: iso(admin.lastLoginAt),
  };
}

export function adminSettings(settings: Settings) {
  return {
    defaultPayinCommissionRate: toNumber(settings.defaultPayinCommissionRate),
    defaultPayoutCommissionRate: toNumber(settings.defaultPayoutCommissionRate),
    minDepositAmount: toNumber(settings.minDepositAmount),
    requiredSecurityDepositUsdt: toNumber(settings.requiredSecurityDepositUsdt),
    supportWelcomeMessage: settings.supportWelcomeMessage,
    signupsEnabled: settings.signupsEnabled,
    autoApproveDeposits: settings.autoApproveDeposits,
    requireAgentApproval: settings.requireAgentApproval,
    updatedAt: iso(settings.updatedAt),
  };
}

export function adminAuditLog(
  log: AuditLog & { admin?: Pick<Admin, "id" | "name" | "email"> | null },
) {
  return {
    id: log.id,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    summary: log.summary,
    meta: log.meta,
    admin: log.admin
      ? { id: log.admin.id, name: log.admin.name, email: log.admin.email }
      : null,
    createdAt: iso(log.createdAt),
  };
}

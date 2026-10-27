/**
 * Re-exports the Prisma model types from one place. `Notification` is
 * aliased because the DOM already has a global of that name.
 */
export type {
  Admin,
  AdminRole,
  Agent,
  AgentStatus,
  AuditLog,
  BankAccount,
  Deposit,
  Payin,
  Payout,
  PayoutStatus,
  Settings,
  SupportMessage,
  TxnStatus,
} from "@prisma/client";

export type { Notification as AppNotification } from "@prisma/client";

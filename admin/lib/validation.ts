import { z } from "zod";

/**
 * Request schemas. The field rules deliberately mirror
 * lib/core/utils/validators.dart in the Flutter app, so a value the app
 * accepts is never rejected by the server for a different reason.
 */

const MOBILE = /^[6-9]\d{9}$/;
const EMAIL = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI = /^[\w.-]{2,}@[a-zA-Z]{2,}$/;
const ACCOUNT_NUMBER = /^\d{9,18}$/;

export const mobileSchema = z
  .string()
  .trim()
  .regex(MOBILE, "Enter a valid 10-digit mobile number");

export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(128, "Password must be at most 128 characters");

export const emailSchema = z
  .string()
  .trim()
  .regex(EMAIL, "Enter a valid email address");

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Full name is required")
  .max(80, "Full name is too long");

export const amountSchema = z.coerce
  .number()
  .finite("Enter a valid amount")
  .positive("Enter a valid amount")
  .max(99_999_999.99, "Amount is too large");

export const rateSchema = z.coerce
  .number()
  .min(0, "Commission rate cannot be negative")
  .max(100, "Commission rate cannot exceed 100%");

export const upiSchema = z
  .string()
  .trim()
  .regex(UPI, "Enter a valid UPI ID (e.g. name@bank)");

// ---------------------------------------------------------------------------
// Agent API (v1)
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  mobile: mobileSchema,
  password: z.string().min(1, "Password is required"),
});

export const signupSchema = z.object({
  name: nameSchema,
  mobile: mobileSchema,
  email: emailSchema,
  password: passwordSchema,
  /// A master's code, tying this agent to them. Optional.
  referralCode: z
    .union([z.literal(""), z.string().trim().min(4).max(16)])
    .optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});

export const resetPasswordSchema = z.object({
  mobile: mobileSchema,
  newPassword: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

export const bankAccountSchema = z.object({
  bankName: z.string().trim().min(1, "Bank name is required").max(80),
  accountHolder: z
    .string()
    .trim()
    .min(1, "Account holder name is required")
    .max(80),
  accountNumber: z
    .string()
    .trim()
    .regex(ACCOUNT_NUMBER, "Account number must be 9-18 digits"),
  ifsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(IFSC, "Enter a valid IFSC (e.g. SBIN0001234)"),
  upiId: upiSchema,
  limit: z.coerce.number().int().min(0).max(100_000_000).optional(),
  dailyLimit: z.coerce.number().int().min(0).max(100_000_000).optional(),
  amountLimit: z.coerce.number().min(0).max(99_999_999.99),
  txnLimit: z.coerce.number().int().min(0).max(100_000_000),
  isActive: z.boolean().optional(),
});

export const bankAccountUpdateSchema = bankAccountSchema.partial();

export const setBankActiveSchema = z.object({ isActive: z.boolean() });

/**
 * `amount` is in `currency`. A USDT deposit is converted to rupees by the
 * server at the configured rate, so the client never decides what a deposit
 * is worth.
 *
 * `utr` is a bank reference for INR and a chain transaction hash for USDT,
 * which is why it allows a longer value.
 */
export const createDepositSchema = z.object({
  amount: amountSchema,
  currency: z.enum(["INR", "USDT"]).default("USDT"),
  /// Required for an agent who has not joined yet; ignored afterwards.
  plan: z.enum(["AGENT", "MASTER"]).optional(),
  utr: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9]{6,80}$/,
      "Enter a valid UTR / transaction reference",
    ),
  proofUrl: z.string().trim().url("Proof must be a URL").optional(),
});

export const sendSupportMessageSchema = z.object({
  text: z.string().trim().min(1, "Message cannot be empty").max(2000),
});

export const markPayoutPaidSchema = z.object({
  note: z.string().trim().max(280).optional(),
});

// ---------------------------------------------------------------------------
// Admin API
// ---------------------------------------------------------------------------

export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const createAgentSchema = z.object({
  name: nameSchema,
  mobile: mobileSchema,
  email: emailSchema,
  password: passwordSchema,
  status: z.enum(["PENDING", "ACTIVE", "BLOCKED"]).optional(),
  payinCommissionRate: rateSchema.optional(),
  payoutCommissionRate: rateSchema.optional(),
  securityDepositUsdt: z.coerce.number().min(0).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const updateAgentSchema = z.object({
  name: nameSchema.optional(),
  email: emailSchema.optional(),
  status: z.enum(["PENDING", "ACTIVE", "BLOCKED"]).optional(),
  payinCommissionRate: rateSchema.optional(),
  payoutCommissionRate: rateSchema.optional(),
  securityDepositUsdt: z.coerce.number().min(0).optional(),
  notes: z.string().trim().max(500).optional(),
  password: passwordSchema.optional(),
});

export const adjustBalanceSchema = z.object({
  /** Positive credits the agent, negative debits. */
  amount: z.coerce
    .number()
    .finite()
    .refine((value) => value !== 0, "Enter a non-zero amount"),
  reason: z.string().trim().min(1, "A reason is required").max(280),
});

export const reviewDepositSchema = z.object({
  note: z.string().trim().max(280).optional(),
});

export const createPayinSchema = z.object({
  agentId: z.string().min(1, "Choose an agent"),
  amount: amountSchema,
  txnRef: z.string().trim().min(4, "Enter the player's transaction reference").max(40),
  bankAccountId: z.string().min(1).optional(),
  commissionRate: rateSchema.optional(),
});

export const createPayoutSchema = z.object({
  amount: amountSchema,
  upiId: upiSchema,
  /** Omit to offer the payout to every active agent. */
  agentId: z.string().min(1).optional(),
  commissionRate: rateSchema.optional(),
  note: z.string().trim().max(280).optional(),
});

export const updatePayoutSchema = z.object({
  status: z
    .enum([
      "OPEN",
      "ACCEPTED",
      "PAYMENT_RECEIVED",
      "COMPLETED",
      "FAILED",
      "CANCELLED",
    ])
    .optional(),
  agentId: z.string().min(1).nullable().optional(),
  note: z.string().trim().max(280).optional(),
});

export const sendNotificationSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(120),
    body: z.string().trim().min(1, "Message is required").max(1000),
    /** Omit (or pass broadcast: true) to notify every active agent. */
    agentId: z.string().min(1).optional(),
    broadcast: z.boolean().optional(),
  })
  .refine((value) => Boolean(value.agentId) || value.broadcast === true, {
    message: "Choose an agent, or send it to everyone",
    path: ["agentId"],
  });

export const adminReplySchema = z.object({
  text: z.string().trim().min(1, "Reply cannot be empty").max(2000),
});

// ---------------------------------------------------------------------------
// Super-admin only
// ---------------------------------------------------------------------------

export const createAdminSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    role: z.enum(["SUPER_ADMIN", "OPERATOR", "MASTER_ADMIN"]).optional(),
    /// Required for a MASTER_ADMIN: the agent whose referrals they manage.
    agentId: z.string().min(1).optional(),
  })
  .refine(
    (value) => value.role !== "MASTER_ADMIN" || Boolean(value.agentId),
    {
      message: "Choose the agent this master account belongs to",
      path: ["agentId"],
    },
  );

export const updateAdminSchema = z.object({
  name: nameSchema.optional(),
  role: z.enum(["SUPER_ADMIN", "OPERATOR", "MASTER_ADMIN"]).optional(),
  isActive: z.boolean().optional(),
  password: passwordSchema.optional(),
});

/**
 * Correcting a payin. Changing the amount or the rate moves the agent's
 * balance by the difference — see operations.updatePayin.
 */
export const updatePayinSchema = z
  .object({
    amount: amountSchema.optional(),
    commissionRate: rateSchema.optional(),
    txnRef: z.string().trim().min(4).max(40).optional(),
    reason: z.string().trim().min(1, "Say why this is being corrected").max(280),
  })
  .refine(
    (value) =>
      value.amount !== undefined ||
      value.commissionRate !== undefined ||
      value.txnRef !== undefined,
    { message: "Change at least one field", path: ["amount"] },
  );

/** Correcting a payout's figures. A settled payout re-credits the difference. */
export const updatePayoutAmountsSchema = z
  .object({
    amount: amountSchema.optional(),
    commissionRate: rateSchema.optional(),
    upiId: upiSchema.optional(),
    reason: z.string().trim().min(1, "Say why this is being corrected").max(280),
  })
  .refine(
    (value) =>
      value.amount !== undefined ||
      value.commissionRate !== undefined ||
      value.upiId !== undefined,
    { message: "Change at least one field", path: ["amount"] },
  );

export const updateSettingsSchema = z.object({
  defaultPayinCommissionRate: rateSchema.optional(),
  defaultPayoutCommissionRate: rateSchema.optional(),
  minDepositUsdt: z.coerce.number().min(0).max(99_999_999).optional(),
  agentPlanUsdt: z.coerce.number().positive().max(99_999_999).optional(),
  masterPlanUsdt: z.coerce.number().positive().max(99_999_999).optional(),
  bankTransferEnabled: z.boolean().optional(),
  usdtInrRate: z.coerce
    .number()
    .positive("The USDT rate must be greater than zero")
    .max(100_000)
    .optional(),
  usdtDepositAddress: z
    .string()
    .trim()
    .min(20, "That does not look like a wallet address")
    .max(120)
    .optional(),
  usdtNetwork: z.string().trim().min(2).max(60).optional(),
  requiredSecurityDepositUsdt: z.coerce.number().min(0).optional(),
  supportWelcomeMessage: z.string().trim().min(1).max(500).optional(),
  signupsEnabled: z.boolean().optional(),
  autoApproveDeposits: z.boolean().optional(),
  requireAgentApproval: z.boolean().optional(),
  welcomeEnabled: z.boolean().optional(),
  welcomeTitle: z.string().trim().min(1).max(120).optional(),
  welcomeBody: z.string().trim().min(1).max(2000).optional(),
  promoEnabled: z.boolean().optional(),
  promoHeadline: z.string().trim().max(160).optional(),
  promoImageUrl: z
    .union([z.literal(""), z.string().trim().url("Enter a valid image URL")])
    .optional(),
  promoLinkUrl: z
    .union([z.literal(""), z.string().trim().url("Enter a valid link URL")])
    .optional(),
});

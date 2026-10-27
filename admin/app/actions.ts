"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearAdminCookie,
  requireAdmin,
  revokeAllRefreshTokens,
  setAdminCookie,
} from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { getSettings, prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  adjustBalance,
  approveDeposit,
  createPayout,
  failPayout,
  recordPayin,
  rejectDeposit,
  sendNotification,
  settlePayout,
} from "@/lib/operations";
import { signAdminSession } from "@/lib/tokens";
import {
  adjustBalanceSchema,
  adminLoginSchema,
  adminReplySchema,
  createAgentSchema,
  createPayinSchema,
  createPayoutSchema,
  sendNotificationSchema,
  updateAgentSchema,
  updateSettingsSchema,
} from "@/lib/validation";
import { ZodError } from "zod";
import { type ActionState } from "@/lib/action-state";

/**
 * Server actions behind the panel's forms. Each one funnels into the same
 * lib/operations function the REST API uses, so the two can never drift.
 */

/** Turns thrown errors into a message the form can render. */
async function run(
  work: () => Promise<string | void>,
  revalidate?: string[],
): Promise<ActionState> {
  try {
    const message = await work();
    for (const path of revalidate ?? []) revalidatePath(path);
    return { status: "success", message: message || "Saved" };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        status: "error",
        message: error.issues[0]?.message ?? "Please check the fields",
      };
    }
    if (error instanceof ApiError) {
      return { status: "error", message: error.message };
    }
    // A redirect() inside an action throws; let Next handle it.
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.startsWith("NEXT_")
    ) {
      throw error;
    }
    console.error("[action] failed", error);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}

const str = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
};

const bool = (form: FormData, key: string) => form.get(key) === "on";

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export async function loginAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const result = await run(async () => {
    const { email, password } = adminLoginSchema.parse({
      email: form.get("email"),
      password: form.get("password"),
    });

    const admin = await prisma.admin.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
      throw new ApiError("invalid_credentials", "Incorrect email or password");
    }
    if (!admin.isActive) {
      throw ApiError.forbidden("This admin account has been disabled");
    }

    await setAdminCookie(
      await signAdminSession({
        adminId: admin.id,
        role: admin.role,
        email: admin.email,
      }),
    );
    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
  });

  if (result.status === "error") return result;
  redirect("/");
}

export async function logoutAction() {
  await clearAdminCookie();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Deposits
// ---------------------------------------------------------------------------

export async function approveDepositAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(async () => {
    const admin = await requireAdmin();
    const depositId = str(form, "depositId");
    if (!depositId) throw ApiError.badRequest("Missing deposit");

    const deposit = await approveDeposit({
      depositId,
      adminId: admin.id,
      note: str(form, "note"),
    });
    return `Approved ${deposit.reference}`;
  }, ["/deposits", "/", "/agents"]);
}

export async function rejectDepositAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(async () => {
    const admin = await requireAdmin();
    const depositId = str(form, "depositId");
    if (!depositId) throw ApiError.badRequest("Missing deposit");

    const deposit = await rejectDeposit({
      depositId,
      adminId: admin.id,
      note: str(form, "note"),
    });
    return `Rejected ${deposit.reference}`;
  }, ["/deposits", "/"]);
}

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

export async function createPayoutAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(async () => {
    const admin = await requireAdmin();
    const body = createPayoutSchema.parse({
      amount: form.get("amount"),
      upiId: form.get("upiId"),
      agentId: str(form, "agentId"),
      commissionRate: str(form, "commissionRate"),
      note: str(form, "note"),
    });

    const payout = await createPayout({ ...body, adminId: admin.id });
    return `Created ${payout.reference}`;
  }, ["/payouts", "/"]);
}

export async function settlePayoutAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(async () => {
    const admin = await requireAdmin();
    const payoutId = str(form, "payoutId");
    if (!payoutId) throw ApiError.badRequest("Missing payout");

    const payout = await settlePayout({ payoutId, adminId: admin.id });
    return `Settled ${payout.reference} and credited the agent`;
  }, ["/payouts", "/", "/agents"]);
}

export async function failPayoutAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(async () => {
    const admin = await requireAdmin();
    const payoutId = str(form, "payoutId");
    if (!payoutId) throw ApiError.badRequest("Missing payout");

    const payout = await failPayout({
      payoutId,
      adminId: admin.id,
      note: str(form, "note"),
    });
    return `Marked ${payout.reference} failed`;
  }, ["/payouts", "/"]);
}

export async function releasePayoutAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(async () => {
    const admin = await requireAdmin();
    const payoutId = str(form, "payoutId");
    if (!payoutId) throw ApiError.badRequest("Missing payout");

    const existing = await prisma.payout.findUnique({ where: { id: payoutId } });
    if (!existing) throw ApiError.notFound("Payout");
    if (existing.status === "COMPLETED") {
      throw ApiError.conflict("A settled payout cannot be released");
    }

    const payout = await prisma.payout.update({
      where: { id: payoutId },
      data: { status: "OPEN", agentId: null, acceptedAt: null, paidAt: null },
    });

    await writeAudit({
      adminId: admin.id,
      action: "payout.release",
      entity: "Payout",
      entityId: payoutId,
      summary: `Released payout ${payout.reference} back to the pool`,
      meta: { previousAgentId: existing.agentId },
    });

    return `${payout.reference} is open to all agents again`;
  }, ["/payouts"]);
}

// ---------------------------------------------------------------------------
// Payins
// ---------------------------------------------------------------------------

export async function createPayinAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(async () => {
    const admin = await requireAdmin();
    const body = createPayinSchema.parse({
      agentId: form.get("agentId"),
      amount: form.get("amount"),
      txnRef: form.get("txnRef"),
      bankAccountId: str(form, "bankAccountId"),
      commissionRate: str(form, "commissionRate"),
    });

    const payin = await recordPayin({ ...body, adminId: admin.id });
    return `Recorded ${payin.reference}`;
  }, ["/payins", "/", "/agents"]);
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export async function createAgentAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(async () => {
    const admin = await requireAdmin();
    const settings = await getSettings();
    const body = createAgentSchema.parse({
      name: form.get("name"),
      mobile: form.get("mobile"),
      email: form.get("email"),
      password: form.get("password"),
      status: str(form, "status"),
      payinCommissionRate: str(form, "payinCommissionRate"),
      payoutCommissionRate: str(form, "payoutCommissionRate"),
      securityDepositUsdt: str(form, "securityDepositUsdt"),
      notes: str(form, "notes"),
    });

    const existing = await prisma.agent.findUnique({
      where: { mobile: body.mobile },
      select: { id: true },
    });
    if (existing) {
      throw ApiError.conflict("An agent with this mobile number already exists");
    }

    const agent = await prisma.agent.create({
      data: {
        name: body.name,
        mobile: body.mobile,
        email: body.email,
        passwordHash: await hashPassword(body.password),
        status: body.status ?? "ACTIVE",
        payinCommissionRate:
          body.payinCommissionRate ?? settings.defaultPayinCommissionRate,
        payoutCommissionRate:
          body.payoutCommissionRate ?? settings.defaultPayoutCommissionRate,
        securityDepositUsdt: body.securityDepositUsdt ?? 0,
        notes: body.notes,
      },
    });

    await prisma.supportMessage.create({
      data: {
        agentId: agent.id,
        text: settings.supportWelcomeMessage,
        fromAgent: false,
      },
    });

    await writeAudit({
      adminId: admin.id,
      action: "agent.create",
      entity: "Agent",
      entityId: agent.id,
      summary: `Created agent ${agent.name} (+91 ${agent.mobile})`,
    });

    return `${agent.name} can now sign in with +91 ${agent.mobile}`;
  }, ["/agents", "/"]);
}

export async function updateAgentAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(async () => {
    const admin = await requireAdmin();
    const agentId = str(form, "agentId");
    if (!agentId) throw ApiError.badRequest("Missing agent");

    const body = updateAgentSchema.parse({
      name: str(form, "name"),
      email: str(form, "email"),
      status: str(form, "status"),
      payinCommissionRate: str(form, "payinCommissionRate"),
      payoutCommissionRate: str(form, "payoutCommissionRate"),
      securityDepositUsdt: str(form, "securityDepositUsdt"),
      notes: str(form, "notes"),
      password: str(form, "password"),
    });

    const existing = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!existing) throw ApiError.notFound("Agent");

    const agent = await prisma.agent.update({
      where: { id: agentId },
      data: {
        name: body.name,
        email: body.email,
        status: body.status,
        payinCommissionRate: body.payinCommissionRate,
        payoutCommissionRate: body.payoutCommissionRate,
        securityDepositUsdt: body.securityDepositUsdt,
        notes: body.notes,
        ...(body.password
          ? { passwordHash: await hashPassword(body.password) }
          : {}),
      },
    });

    if (body.password || (body.status && body.status !== "ACTIVE")) {
      await revokeAllRefreshTokens(agentId);
    }

    await writeAudit({
      adminId: admin.id,
      action:
        body.status && body.status !== existing.status
          ? `agent.${body.status.toLowerCase()}`
          : "agent.update",
      entity: "Agent",
      entityId: agentId,
      summary:
        body.status && body.status !== existing.status
          ? `Set ${agent.name} to ${body.status}`
          : `Updated ${agent.name}`,
      meta: { previousStatus: existing.status },
    });

    return "Agent updated";
  }, ["/agents", "/"]);
}

export async function adjustBalanceAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(async () => {
    const admin = await requireAdmin();
    const agentId = str(form, "agentId");
    if (!agentId) throw ApiError.badRequest("Missing agent");

    const direction = form.get("direction") === "debit" ? -1 : 1;
    const parsed = adjustBalanceSchema.parse({
      amount: Number(form.get("amount")) * direction,
      reason: form.get("reason"),
    });

    const result = await adjustBalance({
      agentId,
      amount: parsed.amount,
      reason: parsed.reason,
      adminId: admin.id,
    });

    return `Balance is now ₹${result.newBalance.toFixed(2)}`;
  }, ["/agents", "/"]);
}

// ---------------------------------------------------------------------------
// Notifications & support
// ---------------------------------------------------------------------------

export async function sendNotificationAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(async () => {
    const admin = await requireAdmin();
    const broadcast = bool(form, "broadcast");
    const body = sendNotificationSchema.parse({
      title: form.get("title"),
      body: form.get("body"),
      agentId: broadcast ? undefined : str(form, "agentId"),
      broadcast,
    });

    const result = await sendNotification({
      title: body.title,
      body: body.body,
      agentId: body.agentId,
      broadcast: body.broadcast,
      adminId: admin.id,
    });

    return `Sent to ${result.recipients} agent${result.recipients === 1 ? "" : "s"}`;
  }, ["/notifications"]);
}

export async function replySupportAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(async () => {
    const admin = await requireAdmin();
    const agentId = str(form, "agentId");
    if (!agentId) throw ApiError.badRequest("Missing agent");

    const { text } = adminReplySchema.parse({ text: form.get("text") });

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true },
    });
    if (!agent) throw ApiError.notFound("Agent");

    await prisma.supportMessage.create({
      data: { agentId, text, fromAgent: false, adminId: admin.id },
    });

    return "Reply sent";
  }, ["/support"]);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function updateSettingsAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(async () => {
    const admin = await requireAdmin();
    await getSettings();

    const body = updateSettingsSchema.parse({
      defaultPayinCommissionRate: str(form, "defaultPayinCommissionRate"),
      defaultPayoutCommissionRate: str(form, "defaultPayoutCommissionRate"),
      minDepositAmount: str(form, "minDepositAmount"),
      requiredSecurityDepositUsdt: str(form, "requiredSecurityDepositUsdt"),
      supportWelcomeMessage: str(form, "supportWelcomeMessage"),
      signupsEnabled: bool(form, "signupsEnabled"),
      autoApproveDeposits: bool(form, "autoApproveDeposits"),
      requireAgentApproval: bool(form, "requireAgentApproval"),
    });

    await prisma.settings.update({ where: { id: "default" }, data: body });

    await writeAudit({
      adminId: admin.id,
      action: "settings.update",
      entity: "Settings",
      entityId: "default",
      summary: "Updated platform settings",
      meta: body,
    });

    return "Settings saved";
  }, ["/settings"]);
}

// ---------------------------------------------------------------------------
// Bank accounts
// ---------------------------------------------------------------------------

export async function toggleBankAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(async () => {
    const admin = await requireAdmin();
    const bankId = str(form, "bankId");
    if (!bankId) throw ApiError.badRequest("Missing bank account");

    const existing = await prisma.bankAccount.findUnique({ where: { id: bankId } });
    if (!existing) throw ApiError.notFound("Bank account");

    const bank = await prisma.bankAccount.update({
      where: { id: bankId },
      data: { isActive: !existing.isActive },
    });

    await writeAudit({
      adminId: admin.id,
      action: bank.isActive ? "bank.activate" : "bank.deactivate",
      entity: "BankAccount",
      entityId: bankId,
      summary: `${bank.isActive ? "Activated" : "Deactivated"} ${bank.bankName} ****${bank.accountNumber.slice(-4)}`,
      meta: { agentId: bank.agentId },
    });

    return `${bank.bankName} is now ${bank.isActive ? "active" : "inactive"}`;
  }, ["/banks", "/agents"]);
}

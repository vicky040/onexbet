"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearAdminCookie,
  requireFullAdmin,
  requireSuperAdmin,
  revokeAllRefreshTokens,
  setAdminCookie,
} from "@/lib/auth";
import { adminScope, assertAgentInScope } from "@/lib/scope";
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
  updatePayin,
  updatePayoutAmounts,
} from "@/lib/operations";
import { signAdminSession } from "@/lib/tokens";
import {
  adjustBalanceSchema,
  adminLoginSchema,
  adminReplySchema,
  createAdminSchema,
  createAgentSchema,
  createPayinSchema,
  createPayoutSchema,
  sendNotificationSchema,
  updateAdminSchema,
  updateAgentSchema,
  updatePayinSchema,
  updatePayoutAmountsSchema,
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
    const admin = await requireFullAdmin();
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
    const admin = await requireFullAdmin();
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
    const admin = await requireFullAdmin();
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
    const admin = await requireFullAdmin();
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
    const admin = await requireFullAdmin();
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
    const admin = await requireFullAdmin();
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
    const admin = await requireFullAdmin();
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
    const scope = await adminScope();
    if (!scope.isMaster && scope.admin.role !== "SUPER_ADMIN") {
      throw ApiError.forbidden("Only a super admin can create agents");
    }
    const admin = scope.admin;
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
        securityDepositUsdt: scope.isMaster ? 0 : (body.securityDepositUsdt ?? 0),
        notes: scope.isMaster ? null : body.notes,
        // A master's agents are referred by that master.
        referredById: scope.isMaster ? scope.admin.agentId : null,
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
    const scope = await adminScope();
    if (!scope.isMaster && scope.admin.role !== "SUPER_ADMIN") {
      throw ApiError.forbidden("Only a super admin can change agent details");
    }
    const admin = scope.admin;
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

    if (scope.isMaster) assertAgentInScope(scope, agentId);

    const existing = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!existing) throw ApiError.notFound("Agent");

    if (scope.isMaster) {
      const agent = await prisma.agent.update({
        where: { id: agentId },
        data: {
          payinCommissionRate: body.payinCommissionRate,
          payoutCommissionRate: body.payoutCommissionRate,
        },
      });

      await writeAudit({
        adminId: admin.id,
        action: "agent.update",
        entity: "Agent",
        entityId: agentId,
        summary: `Master updated commission for ${agent.name}`,
        meta: { byMaster: true },
      });

      return "Commission updated";
    }

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
    const admin = await requireSuperAdmin();
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
    const admin = await requireFullAdmin();
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
    const admin = await requireFullAdmin();
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
    const admin = await requireSuperAdmin();
    await getSettings();

    const body = updateSettingsSchema.parse({
      defaultPayinCommissionRate: str(form, "defaultPayinCommissionRate"),
      defaultPayoutCommissionRate: str(form, "defaultPayoutCommissionRate"),
      minDepositUsdt: str(form, "minDepositUsdt"),
      agentPlanUsdt: str(form, "agentPlanUsdt"),
      masterPlanUsdt: str(form, "masterPlanUsdt"),
      bankTransferEnabled: bool(form, "bankTransferEnabled"),
      usdtInrRate: str(form, "usdtInrRate"),
      usdtDepositAddress: str(form, "usdtDepositAddress"),
      usdtNetwork: str(form, "usdtNetwork"),
      requiredSecurityDepositUsdt: str(form, "requiredSecurityDepositUsdt"),
      supportWelcomeMessage: str(form, "supportWelcomeMessage"),
      signupsEnabled: bool(form, "signupsEnabled"),
      autoApproveDeposits: bool(form, "autoApproveDeposits"),
      requireAgentApproval: bool(form, "requireAgentApproval"),
      welcomeEnabled: bool(form, "welcomeEnabled"),
      welcomeTitle: str(form, "welcomeTitle"),
      welcomeBody: str(form, "welcomeBody"),
      promoEnabled: bool(form, "promoEnabled"),
      promoHeadline: form.get("promoHeadline")?.toString().trim() ?? "",
      promoImageUrl: form.get("promoImageUrl")?.toString().trim() ?? "",
      promoLinkUrl: form.get("promoLinkUrl")?.toString().trim() ?? "",
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
    const admin = await requireSuperAdmin();
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

// ---------------------------------------------------------------------------
// Panel users (super admin)
// ---------------------------------------------------------------------------

export async function createAdminAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(async () => {
    const actor = await requireSuperAdmin();
    const body = createAdminSchema.parse({
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      role: str(form, "role"),
      agentId: str(form, "agentId"),
    });
    const email = body.email.toLowerCase();

    const existing = await prisma.admin.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw ApiError.conflict("An admin with this email already exists");
    }

    // A master account is only meaningful attached to an agent on the
    // Master plan: that link is how we know whose referrals they manage.
    if (body.role === "MASTER_ADMIN") {
      const agent = await prisma.agent.findUnique({
        where: { id: body.agentId },
        select: { plan: true, panelAccount: { select: { id: true } } },
      });
      if (!agent) throw ApiError.notFound("Agent");
      if (agent.plan !== "MASTER") {
        throw ApiError.badRequest(
          "That agent is not on the Master plan yet. Approve their Master deposit first.",
        );
      }
      if (agent.panelAccount) {
        throw ApiError.conflict("That agent already has a panel account");
      }
    }

    const created = await prisma.admin.create({
      data: {
        name: body.name,
        email,
        passwordHash: await hashPassword(body.password),
        role: body.role ?? "OPERATOR",
        agentId: body.role === "MASTER_ADMIN" ? body.agentId : null,
      },
    });

    await writeAudit({
      adminId: actor.id,
      action: "admin.create",
      entity: "Admin",
      entityId: created.id,
      summary: `Created ${created.role === "SUPER_ADMIN" ? "super admin" : "operator"} ${created.email}`,
      meta: { role: created.role },
    });

    return `${created.email} can now sign in`;
  }, ["/admins"]);
}

export async function updateAdminAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(async () => {
    const actor = await requireSuperAdmin();
    const adminId = str(form, "adminId");
    if (!adminId) throw ApiError.badRequest("Missing admin");

    const rawActive = form.get("isActive");
    const body = updateAdminSchema.parse({
      name: str(form, "name"),
      role: str(form, "role"),
      isActive: rawActive === null ? undefined : rawActive === "true",
      password: str(form, "password"),
    });

    const target = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!target) throw ApiError.notFound("Admin");

    const removesAccess = body.role === "OPERATOR" || body.isActive === false;

    if (target.id === actor.id && removesAccess) {
      throw ApiError.badRequest(
        "You cannot remove your own access. Ask another super admin to do it.",
      );
    }

    if (target.role === "SUPER_ADMIN" && removesAccess) {
      const remaining = await prisma.admin.count({
        where: { role: "SUPER_ADMIN", isActive: true, id: { not: target.id } },
      });
      if (remaining === 0) {
        throw ApiError.conflict(
          "This is the only active super admin. Promote someone else first.",
        );
      }
    }

    const updated = await prisma.admin.update({
      where: { id: adminId },
      data: {
        name: body.name,
        role: body.role,
        isActive: body.isActive,
        ...(body.password
          ? { passwordHash: await hashPassword(body.password) }
          : {}),
      },
    });

    const changed = Object.keys(body).filter(
      (key) => body[key as keyof typeof body] !== undefined,
    );

    await writeAudit({
      adminId: actor.id,
      action: "admin.update",
      entity: "Admin",
      entityId: adminId,
      summary: `Updated ${updated.email} (${changed.join(", ")})`,
      meta: { fields: changed, role: updated.role, isActive: updated.isActive },
    });

    return `${updated.email} updated`;
  }, ["/admins"]);
}

// ---------------------------------------------------------------------------
// Corrections (super admin)
// ---------------------------------------------------------------------------

export async function updatePayinAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(async () => {
    const admin = await requireSuperAdmin();
    const payinId = str(form, "payinId");
    if (!payinId) throw ApiError.badRequest("Missing payin");

    const body = updatePayinSchema.parse({
      amount: str(form, "amount"),
      commissionRate: str(form, "commissionRate"),
      txnRef: str(form, "txnRef"),
      reason: form.get("reason"),
    });

    const payin = await updatePayin({
      payinId,
      amount: body.amount,
      commissionRate: body.commissionRate,
      txnRef: body.txnRef,
      reason: body.reason,
      adminId: admin.id,
    });

    return `Corrected ${payin.reference}`;
  }, ["/payins", "/", "/agents"]);
}

export async function updatePayoutAmountsAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(async () => {
    const admin = await requireSuperAdmin();
    const payoutId = str(form, "payoutId");
    if (!payoutId) throw ApiError.badRequest("Missing payout");

    const body = updatePayoutAmountsSchema.parse({
      amount: str(form, "amount"),
      commissionRate: str(form, "commissionRate"),
      upiId: str(form, "upiId"),
      reason: form.get("reason"),
    });

    const payout = await updatePayoutAmounts({
      payoutId,
      amount: body.amount,
      commissionRate: body.commissionRate,
      upiId: body.upiId,
      reason: body.reason,
      adminId: admin.id,
    });

    return `Corrected ${payout.reference}`;
  }, ["/payouts", "/", "/agents"]);
}

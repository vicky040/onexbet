import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { ok, readBody, withRoute } from "@/lib/http";
import { adminBankAccount } from "@/lib/admin-serializers";
import { bankAccountUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const schema = bankAccountUpdateSchema.extend({
  isActive: z.boolean().optional(),
});

/** Admins can correct an agent's bank details or switch it on and off. */
export const PATCH = withRoute(async (request: Request, { params }: Params) => {
  const admin = await requireSuperAdmin();
  const { id } = await params;
  const body = await readBody(request, schema);

  const existing = await prisma.bankAccount.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Bank account");

  const dailyLimit = body.dailyLimit ?? body.limit;
  const bank = await prisma.bankAccount.update({
    where: { id },
    data: {
      bankName: body.bankName,
      accountHolder: body.accountHolder,
      accountNumber: body.accountNumber,
      ifsc: body.ifsc,
      upiId: body.upiId,
      ...(dailyLimit === undefined ? {} : { dailyLimit }),
      amountLimit: body.amountLimit,
      txnLimit: body.txnLimit,
      isActive: body.isActive,
    },
    include: {
      agent: { select: { id: true, name: true, mobile: true, status: true } },
    },
  });

  await writeAudit({
    adminId: admin.id,
    action: "bank.update",
    entity: "BankAccount",
    entityId: id,
    summary: `Updated ${bank.bankName} ****${bank.accountNumber.slice(-4)}`,
    meta: { agentId: bank.agentId, isActive: bank.isActive },
  });

  return ok(adminBankAccount(bank));
});

export const DELETE = withRoute(async (_request: Request, { params }: Params) => {
  const admin = await requireSuperAdmin();
  const { id } = await params;

  const existing = await prisma.bankAccount.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Bank account");

  await prisma.bankAccount.delete({ where: { id } });

  await writeAudit({
    adminId: admin.id,
    action: "bank.delete",
    entity: "BankAccount",
    entityId: id,
    summary: `Deleted ${existing.bankName} ****${existing.accountNumber.slice(-4)}`,
    meta: { agentId: existing.agentId },
  });

  return ok({ deleted: true });
});

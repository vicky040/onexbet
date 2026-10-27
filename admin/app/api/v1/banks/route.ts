import { requireAgent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, readBody, withRoute } from "@/lib/http";
import { serializeBankAccount } from "@/lib/serializers";
import { bankAccountSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Backs BankRepository.banks(). */
export const GET = withRoute(async (request: Request) => {
  const agent = await requireAgent(request);

  const banks = await prisma.bankAccount.findMany({
    where: { agentId: agent.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  return ok(banks.map(serializeBankAccount));
});

/** Backs BankRepository.save() for a new account. */
export const POST = withRoute(async (request: Request) => {
  const agent = await requireAgent(request);
  const body = await readBody(request, bankAccountSchema);

  const bank = await prisma.bankAccount.create({
    data: {
      agentId: agent.id,
      bankName: body.bankName,
      accountHolder: body.accountHolder,
      accountNumber: body.accountNumber,
      ifsc: body.ifsc,
      upiId: body.upiId,
      dailyLimit: body.dailyLimit ?? body.limit ?? 0,
      amountLimit: body.amountLimit,
      txnLimit: body.txnLimit,
      isActive: body.isActive ?? false,
    },
  });

  return ok(serializeBankAccount(bank), { status: 201 });
});

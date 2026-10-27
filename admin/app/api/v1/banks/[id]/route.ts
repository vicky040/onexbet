import { requireAgent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { ok, readBody, withRoute } from "@/lib/http";
import { serializeBankAccount } from "@/lib/serializers";
import { bankAccountUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Loads a bank account, refusing one that belongs to another agent. */
async function ownedBank(agentId: string, id: string) {
  const bank = await prisma.bankAccount.findFirst({ where: { id, agentId } });
  if (!bank) throw ApiError.notFound("Bank account");
  return bank;
}

export const GET = withRoute(async (request: Request, { params }: Params) => {
  const agent = await requireAgent(request);
  const { id } = await params;
  return ok(serializeBankAccount(await ownedBank(agent.id, id)));
});

/** Backs BankRepository.save() for an existing account. */
export const PATCH = withRoute(async (request: Request, { params }: Params) => {
  const agent = await requireAgent(request);
  const { id } = await params;
  await ownedBank(agent.id, id);

  const body = await readBody(request, bankAccountUpdateSchema);
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
  });

  return ok(serializeBankAccount(bank));
});

/** Backs BankRepository.delete(). */
export const DELETE = withRoute(async (request: Request, { params }: Params) => {
  const agent = await requireAgent(request);
  const { id } = await params;
  await ownedBank(agent.id, id);

  await prisma.bankAccount.delete({ where: { id } });
  return ok({ deleted: true });
});

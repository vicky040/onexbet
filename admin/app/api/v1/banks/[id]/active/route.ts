import { requireAgent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { ok, readBody, withRoute } from "@/lib/http";
import { serializeBankAccount } from "@/lib/serializers";
import { setBankActiveSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Backs BankRepository.setActive() — the switch on each bank card. */
export const PATCH = withRoute(async (request: Request, { params }: Params) => {
  const agent = await requireAgent(request);
  const { id } = await params;
  const { isActive } = await readBody(request, setBankActiveSchema);

  const owned = await prisma.bankAccount.findFirst({
    where: { id, agentId: agent.id },
    select: { id: true },
  });
  if (!owned) throw ApiError.notFound("Bank account");

  const bank = await prisma.bankAccount.update({
    where: { id },
    data: { isActive },
  });

  return ok(serializeBankAccount(bank));
});

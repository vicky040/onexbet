import { requireAgent } from "@/lib/auth";
import { getSettings, prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { ok, pageMeta, readBody, readPagination, withRoute } from "@/lib/http";
import { formatInr } from "@/lib/money";
import { createDeposit } from "@/lib/operations";
import { serializeDeposit } from "@/lib/serializers";
import { createDepositSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Backs WalletRepository.deposits() — the History tab's Deposit Records. */
export const GET = withRoute(async (request: Request) => {
  const agent = await requireAgent(request);
  const url = new URL(request.url);
  const page = readPagination(url, { defaultPerPage: 50 });

  const where = { agentId: agent.id };
  const [records, total] = await Promise.all([
    prisma.deposit.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: page.skip,
      take: page.take,
    }),
    prisma.deposit.count({ where }),
  ]);

  return ok(records.map(serializeDeposit), { meta: pageMeta(page, total) });
});

/** Backs WalletRepository.createDeposit() — the Deposit screen. */
export const POST = withRoute(async (request: Request) => {
  const agent = await requireAgent(request);
  const body = await readBody(request, createDepositSchema);
  const settings = await getSettings();

  if (body.amount < Number(settings.minDepositAmount)) {
    throw ApiError.badRequest(
      `Minimum deposit is ${formatInr(settings.minDepositAmount)}`,
    );
  }

  const duplicate = await prisma.deposit.findFirst({
    where: { agentId: agent.id, utr: body.utr },
    select: { reference: true },
  });
  if (duplicate) {
    throw ApiError.conflict(
      `This UTR was already submitted on deposit ${duplicate.reference}`,
    );
  }

  const deposit = await createDeposit({
    agentId: agent.id,
    amount: body.amount,
    utr: body.utr,
    proofUrl: body.proofUrl,
    autoApprove: settings.autoApproveDeposits,
  });

  return ok(serializeDeposit(deposit), { status: 201 });
});

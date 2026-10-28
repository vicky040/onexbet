import { requireAgent } from "@/lib/auth";
import { getSettings, prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { ok, pageMeta, readBody, readPagination, withRoute } from "@/lib/http";
import { D, formatInr, toNumber } from "@/lib/money";
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

/**
 * Backs WalletRepository.createDeposit() — the Deposit screen.
 *
 * An agent who has not joined yet is buying a plan, so `plan` is required
 * and the amount must match that plan's price exactly. Afterwards it is an
 * ordinary top-up and only the minimum applies.
 *
 * Bank transfer is refused while the switch is off, so turning it on is the
 * only thing standing between here and accepting rupees.
 */
export const POST = withRoute(async (request: Request) => {
  const agent = await requireAgent(request);
  const body = await readBody(request, createDepositSchema);
  const settings = await getSettings();

  if (body.currency === "INR" && !settings.bankTransferEnabled) {
    throw ApiError.badRequest(
      "Bank transfer is not available yet. Please pay in USDT.",
    );
  }

  const rate = toNumber(settings.usdtInrRate);
  const hasJoined = agent.plan !== "NONE";
  let plan: "AGENT" | "MASTER" | undefined;

  if (!hasJoined) {
    // The first deposit buys a plan, so the amount is not the agent's to
    // choose — it is whatever that plan costs.
    if (!body.plan) {
      throw ApiError.badRequest(
        "Choose the Agent or Master plan to get started",
      );
    }

    plan = body.plan;
    const priceUsdt =
      plan === "MASTER" ? settings.masterPlanUsdt : settings.agentPlanUsdt;
    const expected =
      body.currency === "USDT" ? toNumber(priceUsdt) : toNumber(D(priceUsdt).mul(rate));

    if (Math.abs(body.amount - expected) > 0.01) {
      throw ApiError.badRequest(
        body.currency === "USDT"
          ? `The ${plan === "MASTER" ? "Master" : "Agent"} plan costs ${expected.toLocaleString("en-IN")} USDT`
          : `The ${plan === "MASTER" ? "Master" : "Agent"} plan costs ${formatInr(expected)}`,
      );
    }
  } else {
    const minUsdt = toNumber(settings.minDepositUsdt);
    const minInr = toNumber(D(settings.minDepositUsdt).mul(settings.usdtInrRate));

    if (body.currency === "USDT") {
      if (body.amount < minUsdt) {
        throw ApiError.badRequest(
          `Minimum deposit is ${minUsdt.toLocaleString("en-IN")} USDT`,
        );
      }
    } else if (body.amount < minInr) {
      throw ApiError.badRequest(
        `Minimum deposit is ${formatInr(minInr)} (${minUsdt.toLocaleString(
          "en-IN",
        )} USDT at ${formatInr(rate)})`,
      );
    }
  }

  const duplicate = await prisma.deposit.findFirst({
    where: { agentId: agent.id, utr: body.utr },
    select: { reference: true },
  });
  if (duplicate) {
    throw ApiError.conflict(
      `This reference was already submitted on deposit ${duplicate.reference}`,
    );
  }

  const deposit = await createDeposit({
    agentId: agent.id,
    amount: body.amount,
    currency: body.currency,
    usdtRate: rate,
    plan,
    utr: body.utr,
    proofUrl: body.proofUrl,
    autoApprove: settings.autoApproveDeposits,
  });

  return ok(serializeDeposit(deposit), { status: 201 });
});

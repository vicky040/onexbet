import { requireAgent } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { ok, withRoute } from "@/lib/http";
import { D, toNumber } from "@/lib/money";

export const dynamic = "force-dynamic";

/**
 * What the Deposit screen needs to render itself.
 *
 * Two shapes, depending on the agent:
 *
 * - **Not joined yet** (`plan: "NONE"`): they pick one of `plans`, and the
 *   amount is fixed by that choice.
 * - **Joined**: they top up their float with any amount above the minimum.
 *
 * Which currencies appear is also the server's call — bank transfer stays
 * out of the list until an admin switches it on.
 */
export const GET = withRoute(async (request: Request) => {
  const agent = await requireAgent(request);
  const settings = await getSettings();

  const rate = toNumber(settings.usdtInrRate);
  const inr = (usdt: typeof settings.minDepositUsdt) =>
    toNumber(D(usdt).mul(settings.usdtInrRate));

  const hasJoined = agent.plan !== "NONE";

  const currencies = [
    {
      code: "USDT",
      label: "USDT",
      symbol: "USDT",
      minimum: toNumber(settings.minDepositUsdt),
      referenceLabel: "Transaction hash",
      address: settings.usdtDepositAddress,
      network: settings.usdtNetwork,
    },
  ];

  if (settings.bankTransferEnabled) {
    currencies.push({
      code: "INR",
      label: "Bank transfer",
      symbol: "₹",
      minimum: inr(settings.minDepositUsdt),
      referenceLabel: "UTR / Reference number",
    } as (typeof currencies)[number]);
  }

  return ok({
    usdtInrRate: rate,
    bankTransferEnabled: settings.bankTransferEnabled,
    agentPlan: agent.plan,
    hasJoined,
    referralCode: agent.referralCode,
    currencies,
    // Only meaningful before joining; sent either way so the app can show
    // what each plan costs.
    plans: [
      {
        code: "AGENT",
        label: "Agent plan",
        description:
          "Take payins and payouts, and earn commission on every transaction.",
        priceUsdt: toNumber(settings.agentPlanUsdt),
        priceInr: inr(settings.agentPlanUsdt),
        // Held back rather than credited as float, so the app can say so
        // before anyone pays.
        securityUsdt: toNumber(settings.agentPlanSecurityUsdt),
      },
      {
        code: "MASTER",
        label: "Master plan",
        description:
          "Everything in the Agent plan, plus your own referral code and a " +
          "panel to manage the agents you bring in.",
        priceUsdt: toNumber(settings.masterPlanUsdt),
        priceInr: inr(settings.masterPlanUsdt),
        securityUsdt: toNumber(settings.masterPlanSecurityUsdt),
      },
    ],
  });
});

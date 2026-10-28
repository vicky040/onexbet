import { requireAgent } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { ok, withRoute } from "@/lib/http";
import { D, toNumber } from "@/lib/money";

export const dynamic = "force-dynamic";

/**
 * What the Deposit screen needs to render: the two currencies, their
 * minimums, and where to send USDT.
 *
 * The minimums live here rather than in the app so the floor can be moved
 * without shipping a build, and so the rupee figure always matches the rate
 * the server will actually use.
 */
export const GET = withRoute(async (request: Request) => {
  await requireAgent(request);
  const settings = await getSettings();

  const minUsdt = toNumber(settings.minDepositUsdt);
  const rate = toNumber(settings.usdtInrRate);

  return ok({
    usdtInrRate: rate,
    currencies: [
      {
        code: "INR",
        label: "Bank transfer",
        symbol: "₹",
        minimum: toNumber(D(settings.minDepositUsdt).mul(settings.usdtInrRate)),
        /** What the agent types in to identify their payment. */
        referenceLabel: "UTR / Reference number",
      },
      {
        code: "USDT",
        label: "USDT",
        symbol: "USDT",
        minimum: minUsdt,
        referenceLabel: "Transaction hash",
        address: settings.usdtDepositAddress,
        network: settings.usdtNetwork,
      },
    ],
  });
});

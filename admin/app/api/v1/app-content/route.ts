import { getSettings } from "@/lib/db";
import { ok, withRoute } from "@/lib/http";
import { D, toNumber } from "@/lib/money";

export const dynamic = "force-dynamic";

/**
 * What the app shows on startup, before anyone signs in.
 *
 * Deliberately **unauthenticated**: the welcome dialog and the promotion are
 * shown on the sign-in screen, where there is no token yet. It returns
 * nothing but copy the public is meant to read.
 */
export const GET = withRoute(async () => {
  const settings = await getSettings();

  return ok({
    welcome: {
      enabled: settings.welcomeEnabled,
      title: settings.welcomeTitle,
      body: settings.welcomeBody,
      // The joining requirement is the deposit minimum, so there is only one
      // number to keep up to date.
      joiningMinimumUsdt: toNumber(settings.minDepositUsdt),
      joiningMinimumInr: toNumber(
        D(settings.minDepositUsdt).mul(settings.usdtInrRate),
      ),
    },
    promo: {
      enabled: settings.promoEnabled,
      headline: settings.promoHeadline,
      imageUrl: settings.promoImageUrl,
      linkUrl: settings.promoLinkUrl,
    },
  });
});

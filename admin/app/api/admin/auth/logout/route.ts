import { clearAdminCookie } from "@/lib/auth";
import { ok, withRoute } from "@/lib/http";

export const dynamic = "force-dynamic";

export const POST = withRoute(async () => {
  await clearAdminCookie();
  return ok({ loggedOut: true });
});

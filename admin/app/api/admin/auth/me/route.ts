import { requireAdmin } from "@/lib/auth";
import { ok, withRoute } from "@/lib/http";
import { adminProfile } from "@/lib/admin-serializers";

export const dynamic = "force-dynamic";

export const GET = withRoute(async () => {
  return ok(adminProfile(await requireAdmin()));
});

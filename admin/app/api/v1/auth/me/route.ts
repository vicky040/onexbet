import { requireAgent } from "@/lib/auth";
import { ok, withRoute } from "@/lib/http";
import { serializeAgent } from "@/lib/serializers";
import { agentSummary } from "@/lib/stats";

export const dynamic = "force-dynamic";

/** Backs AuthRepository.currentUser() in the Flutter app. */
export const GET = withRoute(async (request: Request) => {
  const agent = await requireAgent(request);
  return ok({
    user: serializeAgent(agent),
    summary: await agentSummary(agent),
  });
});

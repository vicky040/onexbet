import { rotateRefreshToken } from "@/lib/auth";
import { ok, readBody, withRoute } from "@/lib/http";
import { serializeAgent } from "@/lib/serializers";
import { refreshSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Exchanges a refresh token for a new pair; the old token is revoked. */
export const POST = withRoute(async (request: Request) => {
  const { refreshToken } = await readBody(request, refreshSchema);
  const { agent, session } = await rotateRefreshToken(refreshToken);

  return ok({
    user: serializeAgent(agent),
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresIn: session.expiresIn,
    expiresAt: session.expiresAt.toISOString(),
  });
});

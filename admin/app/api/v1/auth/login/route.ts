import { assertAgentCanSignIn, issueAgentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { ok, readBody, withRoute } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { serializeAgent } from "@/lib/serializers";
import { loginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (request: Request) => {
  const { mobile, password } = await readBody(request, loginSchema);

  const agent = await prisma.agent.findUnique({ where: { mobile } });
  // Same message either way, so the response never reveals which mobile
  // numbers are registered.
  if (!agent || !(await verifyPassword(password, agent.passwordHash))) {
    throw ApiError.invalidCredentials();
  }

  assertAgentCanSignIn(agent);

  const session = await issueAgentSession(agent);
  await prisma.agent.update({
    where: { id: agent.id },
    data: { lastLoginAt: new Date() },
  });

  return ok({
    user: serializeAgent(agent),
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresIn: session.expiresIn,
    expiresAt: session.expiresAt.toISOString(),
  });
});

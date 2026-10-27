import { requireAgent, revokeAllRefreshTokens, issueAgentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { ok, readBody, withRoute } from "@/lib/http";
import { hashPassword, verifyPassword } from "@/lib/password";
import { changePasswordSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (request: Request) => {
  const agent = await requireAgent(request);
  const { currentPassword, newPassword } = await readBody(
    request,
    changePasswordSchema,
  );

  if (!(await verifyPassword(currentPassword, agent.passwordHash))) {
    throw new ApiError("invalid_credentials", "Current password is incorrect");
  }
  if (await verifyPassword(newPassword, agent.passwordHash)) {
    throw ApiError.badRequest("Choose a password you have not used before");
  }

  await prisma.agent.update({
    where: { id: agent.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  // Every other device is signed out, then this one gets a fresh session.
  await revokeAllRefreshTokens(agent.id);
  const session = await issueAgentSession(agent);

  return ok({
    changed: true,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresIn: session.expiresIn,
  });
});

import { issueAgentSession } from "@/lib/auth";
import { getSettings, prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { ok, readBody, withRoute } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { serializeAgent } from "@/lib/serializers";
import { signupSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (request: Request) => {
  const body = await readBody(request, signupSchema);
  const settings = await getSettings();

  if (!settings.signupsEnabled) {
    throw ApiError.forbidden("New sign-ups are closed. Please contact support.");
  }

  const existing = await prisma.agent.findUnique({
    where: { mobile: body.mobile },
    select: { id: true },
  });
  if (existing) {
    throw ApiError.conflict("An account with this mobile number already exists");
  }

  const agent = await prisma.agent.create({
    data: {
      name: body.name,
      mobile: body.mobile,
      email: body.email,
      passwordHash: await hashPassword(body.password),
      status: settings.requireAgentApproval ? "PENDING" : "ACTIVE",
      payinCommissionRate: settings.defaultPayinCommissionRate,
      payoutCommissionRate: settings.defaultPayoutCommissionRate,
    },
  });

  await prisma.supportMessage.create({
    data: {
      agentId: agent.id,
      text: settings.supportWelcomeMessage,
      fromAgent: false,
    },
  });

  // An account awaiting approval gets no tokens — there is nothing it may do
  // yet, and the app shows the pending message instead.
  if (agent.status === "PENDING") {
    return ok(
      {
        user: serializeAgent(agent),
        accessToken: null,
        refreshToken: null,
        pendingApproval: true,
      },
      { status: 201 },
    );
  }

  const session = await issueAgentSession(agent);
  return ok(
    {
      user: serializeAgent(agent),
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresIn: session.expiresIn,
      expiresAt: session.expiresAt.toISOString(),
      pendingApproval: false,
    },
    { status: 201 },
  );
});

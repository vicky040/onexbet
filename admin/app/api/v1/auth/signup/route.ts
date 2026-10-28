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

  // A referral code ties this agent to the master who brought them in. A
  // wrong code is rejected rather than silently ignored — someone typing one
  // in expects it to count.
  let referredById: string | null = null;
  if (body.referralCode) {
    const master = await prisma.agent.findUnique({
      where: { referralCode: body.referralCode.toUpperCase() },
      select: { id: true, plan: true },
    });
    if (!master || master.plan !== "MASTER") {
      throw ApiError.badRequest("That referral code is not valid");
    }
    referredById = master.id;
  }

  const agent = await prisma.agent.create({
    data: {
      name: body.name,
      mobile: body.mobile,
      email: body.email,
      passwordHash: await hashPassword(body.password),
      status: settings.requireAgentApproval ? "PENDING" : "ACTIVE",
      referredById,
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

import type { Prisma } from "@prisma/client";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { getSettings, prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { ok, pageMeta, readBody, readPagination, withRoute } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { adminAgent } from "@/lib/admin-serializers";
import { createAgentSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** `?q=` searches name/mobile/email, `?status=` filters. */
export const GET = withRoute(async (request: Request) => {
  await requireAdmin();
  const url = new URL(request.url);
  const page = readPagination(url);

  const q = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status")?.toUpperCase();

  const where: Prisma.AgentWhereInput = {
    ...(status && ["PENDING", "ACTIVE", "BLOCKED"].includes(status)
      ? { status: status as Prisma.AgentWhereInput["status"] }
      : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { mobile: { contains: q } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [agents, total] = await Promise.all([
    prisma.agent.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: page.skip,
      take: page.take,
      include: {
        _count: {
          select: { payins: true, payouts: true, deposits: true, bankAccounts: true },
        },
      },
    }),
    prisma.agent.count({ where }),
  ]);

  return ok(agents.map(adminAgent), { meta: pageMeta(page, total) });
});

/** Creates an agent directly, bypassing sign-up. */
export const POST = withRoute(async (request: Request) => {
  const admin = await requireSuperAdmin();
  const body = await readBody(request, createAgentSchema);
  const settings = await getSettings();

  const existing = await prisma.agent.findUnique({
    where: { mobile: body.mobile },
    select: { id: true },
  });
  if (existing) {
    throw ApiError.conflict("An agent with this mobile number already exists");
  }

  const agent = await prisma.agent.create({
    data: {
      name: body.name,
      mobile: body.mobile,
      email: body.email,
      passwordHash: await hashPassword(body.password),
      status: body.status ?? "ACTIVE",
      payinCommissionRate:
        body.payinCommissionRate ?? settings.defaultPayinCommissionRate,
      payoutCommissionRate:
        body.payoutCommissionRate ?? settings.defaultPayoutCommissionRate,
      securityDepositUsdt: body.securityDepositUsdt ?? 0,
      notes: body.notes,
    },
  });

  await prisma.supportMessage.create({
    data: {
      agentId: agent.id,
      text: settings.supportWelcomeMessage,
      fromAgent: false,
    },
  });

  await writeAudit({
    adminId: admin.id,
    action: "agent.create",
    entity: "Agent",
    entityId: agent.id,
    summary: `Created agent ${agent.name} (+91 ${agent.mobile})`,
  });

  return ok(adminAgent(agent), { status: 201 });
});

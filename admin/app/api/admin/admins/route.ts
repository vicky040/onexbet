import { requireSuperAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { ok, readBody, withRoute } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { adminUser } from "@/lib/admin-serializers";
import { createAdminSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Everyone who can sign in to this panel. Super admin only. */
export const GET = withRoute(async () => {
  await requireSuperAdmin();

  const admins = await prisma.admin.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { agent: { select: { id: true, name: true, mobile: true } } },
  });

  return ok(admins.map(adminUser));
});

/** Creates a panel user. Super admin only. */
export const POST = withRoute(async (request: Request) => {
  const admin = await requireSuperAdmin();
  const body = await readBody(request, createAdminSchema);
  const email = body.email.toLowerCase();

  const existing = await prisma.admin.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    throw ApiError.conflict("An admin with this email already exists");
  }

  // A master account only makes sense attached to an agent on the Master
  // plan — that link is how we know whose referrals they manage.
  if (body.role === "MASTER_ADMIN") {
    const agent = await prisma.agent.findUnique({
      where: { id: body.agentId },
      select: { id: true, plan: true, panelAccount: { select: { id: true } } },
    });
    if (!agent) throw ApiError.notFound("Agent");
    if (agent.plan !== "MASTER") {
      throw ApiError.badRequest(
        "That agent is not on the Master plan. Approve their Master deposit first.",
      );
    }
    if (agent.panelAccount) {
      throw ApiError.conflict("That agent already has a panel account");
    }
  }

  const created = await prisma.admin.create({
    data: {
      name: body.name,
      email,
      passwordHash: await hashPassword(body.password),
      role: body.role ?? "OPERATOR",
      agentId: body.role === "MASTER_ADMIN" ? body.agentId : null,
    },
  });

  await writeAudit({
    adminId: admin.id,
    action: "admin.create",
    entity: "Admin",
    entityId: created.id,
    summary: `Created ${created.role === "SUPER_ADMIN" ? "super admin" : "operator"} ${created.email}`,
    meta: { role: created.role },
  });

  return ok(adminUser(created), { status: 201 });
});

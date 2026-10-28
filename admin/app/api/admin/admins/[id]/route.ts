import { requireSuperAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { ok, readBody, withRoute } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { adminUser } from "@/lib/admin-serializers";
import { updateAdminSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Updates a panel user. Super admin only, with two locks:
 *
 * - you cannot take away your own access, which would lock you out mid-session
 * - the last active super admin cannot be demoted or disabled, which would
 *   leave nobody able to manage admins at all
 */
export const PATCH = withRoute(async (request: Request, { params }: Params) => {
  const actor = await requireSuperAdmin();
  const { id } = await params;
  const body = await readBody(request, updateAdminSchema);

  const target = await prisma.admin.findUnique({ where: { id } });
  if (!target) throw ApiError.notFound("Admin");

  const losesSuperAdmin =
    target.role === "SUPER_ADMIN" &&
    (body.role === "OPERATOR" || body.isActive === false);

  if (target.id === actor.id && (body.role === "OPERATOR" || body.isActive === false)) {
    throw ApiError.badRequest(
      "You cannot remove your own access. Ask another super admin to do it.",
    );
  }

  if (losesSuperAdmin) {
    const remaining = await prisma.admin.count({
      where: { role: "SUPER_ADMIN", isActive: true, id: { not: target.id } },
    });
    if (remaining === 0) {
      throw ApiError.conflict(
        "This is the only active super admin. Promote someone else first.",
      );
    }
  }

  const updated = await prisma.admin.update({
    where: { id },
    data: {
      name: body.name,
      role: body.role,
      isActive: body.isActive,
      ...(body.password
        ? { passwordHash: await hashPassword(body.password) }
        : {}),
    },
  });

  const changed = Object.keys(body).filter(
    (key) => body[key as keyof typeof body] !== undefined,
  );

  await writeAudit({
    adminId: actor.id,
    action: "admin.update",
    entity: "Admin",
    entityId: id,
    summary: `Updated ${updated.email} (${changed.join(", ")})`,
    meta: {
      fields: changed.map((f) => (f === "password" ? "password" : f)),
      role: updated.role,
      isActive: updated.isActive,
    },
  });

  return ok(adminUser(updated));
});

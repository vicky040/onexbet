import type { Prisma } from "@prisma/client";
import { requireFullAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, pageMeta, readPagination, withRoute } from "@/lib/http";
import { adminAuditLog } from "@/lib/admin-serializers";

export const dynamic = "force-dynamic";

/** `?action=`, `?entity=`, `?entityId=`, `?adminId=`. */
export const GET = withRoute(async (request: Request) => {
  await requireFullAdmin();
  const url = new URL(request.url);
  const page = readPagination(url, { defaultPerPage: 50 });

  const where: Prisma.AuditLogWhereInput = {
    ...(url.searchParams.get("action")
      ? { action: { contains: url.searchParams.get("action")!, mode: "insensitive" } }
      : {}),
    ...(url.searchParams.get("entity") ? { entity: url.searchParams.get("entity")! } : {}),
    ...(url.searchParams.get("entityId")
      ? { entityId: url.searchParams.get("entityId")! }
      : {}),
    ...(url.searchParams.get("adminId")
      ? { adminId: url.searchParams.get("adminId")! }
      : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { admin: { select: { id: true, name: true, email: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: page.skip,
      take: page.take,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return ok(logs.map(adminAuditLog), { meta: pageMeta(page, total) });
});

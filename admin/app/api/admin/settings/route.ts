import { requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { getSettings, prisma } from "@/lib/db";
import { ok, readBody, withRoute } from "@/lib/http";
import { adminSettings } from "@/lib/admin-serializers";
import { updateSettingsSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = withRoute(async () => {
  await requireAdmin();
  return ok(adminSettings(await getSettings()));
});

export const PATCH = withRoute(async (request: Request) => {
  const admin = await requireSuperAdmin();
  const body = await readBody(request, updateSettingsSchema);
  await getSettings();

  const settings = await prisma.settings.update({
    where: { id: "default" },
    data: body,
  });

  const changed = Object.keys(body).filter(
    (key) => body[key as keyof typeof body] !== undefined,
  );

  await writeAudit({
    adminId: admin.id,
    action: "settings.update",
    entity: "Settings",
    entityId: "default",
    summary: `Updated settings (${changed.join(", ") || "no changes"})`,
    meta: body,
  });

  return ok(adminSettings(settings));
});

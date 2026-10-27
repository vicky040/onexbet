import { setAdminCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { ok, readBody, withRoute } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { adminProfile } from "@/lib/admin-serializers";
import { signAdminSession } from "@/lib/tokens";
import { adminLoginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (request: Request) => {
  const { email, password } = await readBody(request, adminLoginSchema);

  const admin = await prisma.admin.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
    throw new ApiError("invalid_credentials", "Incorrect email or password");
  }
  if (!admin.isActive) {
    throw ApiError.forbidden("This admin account has been disabled");
  }

  await setAdminCookie(
    await signAdminSession({
      adminId: admin.id,
      role: admin.role,
      email: admin.email,
    }),
  );

  await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  return ok(adminProfile(admin));
});

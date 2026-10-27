import { z } from "zod";
import { revokeAllRefreshTokens } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { ok, readBody, withRoute } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { hashRefreshToken } from "@/lib/tokens";
import { passwordSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;

const schema = z.object({
  resetToken: z.string().min(1, "resetToken is required"),
  otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  newPassword: passwordSchema,
});

/** Step 2: the code proves the agent owns the number, so set the password. */
export const POST = withRoute(async (request: Request) => {
  const body = await readBody(request, schema);

  const reset = await prisma.passwordReset.findUnique({
    where: { tokenHash: await hashRefreshToken(body.resetToken) },
  });

  const expired =
    !reset ||
    reset.consumedAt !== null ||
    reset.expiresAt < new Date() ||
    reset.attempts >= MAX_ATTEMPTS;

  if (expired) {
    throw ApiError.badRequest(
      "This reset request is no longer valid. Please start again.",
    );
  }

  if (reset.otpHash !== (await hashRefreshToken(body.otp))) {
    const used = await prisma.passwordReset.update({
      where: { id: reset.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    throw new ApiError(
      "invalid_credentials",
      used.attempts >= MAX_ATTEMPTS
        ? "Too many incorrect codes. Please start again."
        : `Incorrect code. ${MAX_ATTEMPTS - used.attempts} attempt(s) left.`,
    );
  }

  await prisma.$transaction([
    prisma.agent.update({
      where: { id: reset.agentId },
      data: { passwordHash: await hashPassword(body.newPassword) },
    }),
    prisma.passwordReset.update({
      where: { id: reset.id },
      data: { consumedAt: new Date() },
    }),
  ]);

  // A reset signs out every existing session.
  await revokeAllRefreshTokens(reset.agentId);

  return ok({ reset: true, message: "Password updated. Please log in." });
});

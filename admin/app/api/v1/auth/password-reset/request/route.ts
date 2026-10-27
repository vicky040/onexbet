import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, readBody, withRoute } from "@/lib/http";
import { generateOtp, sendOtp } from "@/lib/sms";
import { hashRefreshToken, createRefreshToken } from "@/lib/tokens";
import { mobileSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const OTP_TTL_MINUTES = 10;

/**
 * Step 1 of a password reset. Always answers the same way, whether or not
 * the mobile number is registered, so this cannot be used to discover
 * accounts.
 */
export const POST = withRoute(async (request: Request) => {
  const { mobile } = await readBody(
    request,
    z.object({ mobile: mobileSchema }),
  );

  const agent = await prisma.agent.findUnique({
    where: { mobile },
    select: { id: true, status: true },
  });

  const resetToken = createRefreshToken();
  let previewCode: string | undefined;

  if (agent && agent.status !== "BLOCKED") {
    const otp = generateOtp();

    // Any earlier attempt is invalidated.
    await prisma.passwordReset.updateMany({
      where: { agentId: agent.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    await prisma.passwordReset.create({
      data: {
        agentId: agent.id,
        tokenHash: await hashRefreshToken(resetToken),
        otpHash: await hashRefreshToken(otp),
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
      },
    });

    const sms = await sendOtp(mobile, otp);
    previewCode = sms.previewCode;
  }

  return ok({
    resetToken,
    expiresInMinutes: OTP_TTL_MINUTES,
    message: `If an account exists for +91 ${mobile}, a 6-digit code is on its way.`,
    // Development convenience only; never present in production.
    ...(previewCode ? { devOtp: previewCode } : {}),
  });
});

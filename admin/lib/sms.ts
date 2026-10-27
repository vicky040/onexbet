/**
 * Outbound SMS. There is no provider wired up yet, so in development the
 * code is logged (and returned by the API) instead of being sent.
 *
 * To go live, implement `send` against your gateway — MSG91, Twilio, Gupshup —
 * and keep the signature. Nothing else needs to change.
 */

export type SmsResult = { delivered: boolean; previewCode?: string };

export async function sendOtp(mobile: string, code: string): Promise<SmsResult> {
  if (process.env.NODE_ENV === "production") {
    // Fail loudly rather than silently not sending a code someone is waiting for.
    throw new Error(
      "No SMS provider is configured. Implement lib/sms.ts before enabling password resets in production.",
    );
  }

  console.log(`[sms] OTP for +91 ${mobile}: ${code}`);
  return { delivered: false, previewCode: code };
}

export function generateOtp(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) code += (byte % 10).toString();
  return code;
}
